/**
 * Ark Local Runner
 *
 * Polls Supabase for pending sessions and runs them against local Ollama.
 * This is the primary execution path — the web app creates sessions,
 * the runner executes them.
 *
 * Usage: npm run runner
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const POLL_INTERVAL = 3000; // 3 seconds
const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes without a message = stuck

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
);

const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1').trim();

// ── Phase logic ──

function phaseForRound(round: number, config: { diverge: number; challenge: number; converge: number }): string {
  if (round <= config.diverge) return 'diverge';
  if (round <= config.diverge + config.challenge) return 'challenge';
  return 'converge';
}

function getPhaseInstructions(phase: string, agent: Agent, allAgents: Agent[]): string {
  const others = allAgents.filter(a => a.name !== agent.name);
  const otherNames = others.map(a => `${a.name} (${a.role})`).join(', ');
  const base = `You are ${agent.name}. Your role: ${agent.role}.\nOther participants: ${otherNames}`;

  switch (phase) {
    case 'diverge':
      return `${base}\n\nPHASE: DIVERGE\nGenerate a distinct, original perspective. Do NOT agree with or build on what others said — bring something new. Be bold, specific, different. Under 200 words.`;
    case 'challenge':
      return `${base}\n\nPHASE: CHALLENGE\nDirectly engage with specific claims by other agents. Reference their names. Explain why they're wrong, incomplete, or naive — OR strengthen with evidence they missed. No new topics. Be specific and rigorous. Under 200 words.`;
    case 'converge':
      if (agent.role === 'synthesizer' || agent.role === 'judge') {
        return `${base}\n\nPHASE: CONVERGE (synthesizer)\nEvaluate the discussion: what survived scrutiny, what was eliminated, strongest conclusion, unresolved tensions. Be definitive. Under 250 words.`;
      }
      return `${base}\n\nPHASE: CONVERGE\nState your final position incorporating what you learned. What changed your mind? What do you still believe despite pushback? Under 200 words.`;
    default:
      return base;
  }
}

interface Agent {
  name: string;
  role: string;
  soul: string;
  model: string;
  provider: string;
  color?: string;
}

interface HistoryEntry {
  agent_name: string;
  content: string;
  round: number;
  phase: string | null;
}

function buildPrompt(agent: Agent, allAgents: Agent[], topic: string, phase: string, history: HistoryEntry[]): string {
  const phaseInstructions = getPhaseInstructions(phase, agent, allAgents);
  let prompt = `${agent.soul}\n\n---\n\n${phaseInstructions}\n\n---\n\nTOPIC: ${topic}`;

  // Limit history to last 12 messages to prevent context overload degradation on small models
  const recentHistory = history.slice(-12);

  if (recentHistory.length > 0) {
    prompt += '\n\n--- CONVERSATION SO FAR ---\n';
    let currentRound = 0;
    for (const msg of recentHistory) {
      if (msg.round !== currentRound) {
        currentRound = msg.round;
        prompt += `\n[Round ${currentRound}${msg.phase ? ` - ${msg.phase.toUpperCase()}` : ''}]\n`;
      }
      prompt += `${msg.agent_name}: ${msg.content}\n`;
    }
  }

  prompt += `\n--- YOUR TURN ---\nRespond as ${agent.name}. Stay in character. Do NOT prefix your response with your name or role — just speak directly. Do NOT include analysis, planning steps, or internal reasoning. Just speak your position directly.`;
  return prompt;
}

// ── LLM call (routes to provider based on agent config) ──

import { callLLM as callLLMLib } from './lib/llm.js';

async function callLLM(provider: string, model: string, systemPrompt: string, userMessage: string): Promise<{ content: string; thinking: string | null; tokens: number }> {
  const result = await callLLMLib(provider, model, systemPrompt, userMessage);
  return { content: result.content, thinking: result.thinking, tokens: result.tokens_used };
}

// ── Session runner ──

async function runSession(sessionId: string): Promise<void> {
  const { data: session, error } = await db
    .from('ark_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error(`Session not found: ${sessionId}`);

  const agents: Agent[] = session.group_snapshot?.agents || [];
  const phaseConfig = session.phase_config || { diverge: 2, challenge: 2, converge: 1 };
  const topic = session.topic;
  const maxRounds = session.max_rounds;
  const startRound = session.current_round || 0;

  if (agents.length === 0) {
    await db.from('ark_sessions').update({ status: 'error', error_message: 'No agents', completed_at: new Date().toISOString() }).eq('id', sessionId);
    return;
  }

  // Atomically claim the session — only proceed if we're the one who flipped it
  const { data: claimed } = await db
    .from('ark_sessions')
    .update({ status: 'running', started_at: session.started_at || new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', ['pending', 'running']) // Allow claiming pending or resuming stuck
    .select('id');

  if (!claimed || claimed.length === 0) {
    console.log(`  Session already claimed by another runner, skipping`);
    return;
  }

  // Update question run count
  if (session.question_id) {
    const { data: q } = await db.from('ark_questions').select('times_run').eq('id', session.question_id).single();
    if (q) await db.from('ark_questions').update({ times_run: (q.times_run as number) + 1 }).eq('id', session.question_id);
  }

  // Load existing messages (for resuming stuck sessions)
  const { data: existingMsgs } = await db
    .from('ark_messages')
    .select('agent_name, content, round, phase')
    .eq('session_id', sessionId)
    .order('created_at');

  const history: HistoryEntry[] = (existingMsgs || []).map(m => ({
    agent_name: m.agent_name,
    content: m.content,
    round: m.round,
    phase: m.phase,
  }));

  // Figure out where to resume
  let resumeRound = startRound > 0 ? startRound : 1;
  let resumeAgentIdx = 0;
  if (history.length > 0) {
    const lastMsg = history[history.length - 1];
    resumeRound = lastMsg.round;
    const lastAgentIdx = agents.findIndex(a => a.name === lastMsg.agent_name);
    if (lastAgentIdx >= 0 && lastAgentIdx < agents.length - 1) {
      resumeAgentIdx = lastAgentIdx + 1;
    } else {
      resumeRound = lastMsg.round + 1;
      resumeAgentIdx = 0;
    }
  }

  try {
    for (let round = resumeRound; round <= maxRounds; round++) {
      const phase = phaseForRound(round, phaseConfig);
      await db.from('ark_sessions').update({ current_round: round, current_phase: phase }).eq('id', sessionId);

      // Check if stopped
      const { data: current } = await db.from('ark_sessions').select('status').eq('id', sessionId).single();
      if (current?.status === 'stopped') {
        console.log(`  Session stopped by user`);
        return;
      }

      const startIdx = round === resumeRound ? resumeAgentIdx : 0;
      for (let i = startIdx; i < agents.length; i++) {
        const agent = agents[i];
        console.log(`  Round ${round}/${maxRounds} [${phase}] → ${agent.name} (${agent.role})`);

        const prompt = buildPrompt(agent, agents, topic, phase, history);
        const response = await callLLM(agent.provider || 'ollama', agent.model, prompt, `Round ${round}, Phase: ${phase}. Respond as ${agent.name}.`);

        await db.from('ark_messages').insert({
          session_id: sessionId,
          agent_name: agent.name,
          agent_role: agent.role,
          round,
          phase,
          content: response.content,
          thinking: response.thinking || null,
          tokens_used: response.tokens,
          model: agent.model,
        });

        history.push({ agent_name: agent.name, content: response.content, round, phase });

        // GPU cooldown — prevent Metal crashes from sustained back-to-back inference
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // ── Synthesis: independent determination via Claude ──
    console.log(`  Synthesizing determination via Claude...`);
    try {
      const synthesisPrompt = `You are an independent judge reviewing a structured multi-agent discussion.

TOPIC: ${topic}

The discussion had ${maxRounds} rounds across three phases:
- DIVERGE: Agents generated distinct perspectives
- CHALLENGE: Agents stress-tested each other's claims
- CONVERGE: Agents stated final positions

Here is the full discussion:

${history.map(m => `[${m.phase?.toUpperCase()} R${m.round}] ${m.agent_name}: ${m.content}`).join('\n\n')}

---

Write a DETERMINATION — a clear, actionable synthesis of this discussion. Include:
1. **Core question answered**: What did this discussion actually resolve?
2. **Strongest position**: Which perspective survived scrutiny best, and why?
3. **Key tensions unresolved**: What genuine disagreements remain?
4. **Recommended action**: Based on this discussion, what should the participants actually do?

Be direct. Under 400 words. This is a decision document, not a summary.`;

      const synthesis = await callLLM('anthropic', 'claude-haiku-4-5-20251001', synthesisPrompt, 'Produce the determination.');

      await db.from('ark_messages').insert({
        session_id: sessionId,
        agent_name: 'Arbiter',
        agent_role: 'Independent synthesis — final determination',
        round: maxRounds + 1,
        phase: 'synthesis',
        content: synthesis.content,
        tokens_used: synthesis.tokens,
        model: 'claude-haiku-4-5-20251001',
      });

      history.push({ agent_name: 'Arbiter', content: synthesis.content, round: maxRounds + 1, phase: 'synthesis' });
      console.log(`  ✓ Determination posted by Arbiter`);
    } catch (synthErr) {
      console.error(`  ⚠ Synthesis failed (session still completed): ${synthErr instanceof Error ? synthErr.message : 'Unknown'}`);
    }

    await db.from('ark_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`  ✓ Session completed`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`  ✗ Error: ${msg}`);
    await db.from('ark_sessions').update({ status: 'error', error_message: msg, completed_at: new Date().toISOString() }).eq('id', sessionId);
  }
}

// ── Model sync (Ollama + MLX) ──

const MODEL_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastModelSync = 0;

const MLX_BASE = (process.env.MLX_BASE_URL || 'http://localhost:8080/v1').trim();

async function syncOllamaModels() {
  try {
    const baseUrl = OLLAMA_BASE.replace(/\/v1\/?$/, '');
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return;
    const data = await res.json();
    const models: string[] = (data.models || [])
      .map((m: { name: string }) => m.name)
      .filter((n: string) => !n.startsWith('nomic-embed') && !n.startsWith('conn'));

    await db.from('conn_state').upsert({
      key: 'ark_ollama_models',
      value: models,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    console.log(`  Ollama models synced: ${models.join(', ')}`);
  } catch (err) {
    console.error('Ollama model sync error:', err);
  }
}

async function syncMlxModels() {
  try {
    const res = await fetch(`${MLX_BASE}/models`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const data = await res.json();
    const loaded: string[] = (data.data || []).map((m: { id: string }) => m.id);

    // Known MLX models available locally (cached on disk)
    const knownModels = [
      'mlx-community/Qwen3.5-9B-MLX-4bit',
      'mlx-community/Qwen3.5-4B-4bit',
      'mlx-community/NVIDIA-Nemotron-3-Nano-30B-A3B-4bit',
      'mlx-community/Qwen3-14B-4bit',
      'mlx-community/Meta-Llama-3.1-8B-Instruct-4bit',
    ];

    // Merge: loaded model first, then known models (deduped)
    const models = Array.from(new Set([...loaded, ...knownModels]));

    await db.from('conn_state').upsert({
      key: 'ark_mlx_models',
      value: models,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    console.log(`  MLX models synced: ${loaded.length} loaded, ${models.length} total`);
  } catch {
    // MLX server not running — store known models anyway so UI can show them
    const knownModels = [
      'mlx-community/Qwen3.5-9B-MLX-4bit',
      'mlx-community/Qwen3.5-4B-4bit',
      'mlx-community/NVIDIA-Nemotron-3-Nano-30B-A3B-4bit',
      'mlx-community/Qwen3-14B-4bit',
      'mlx-community/Meta-Llama-3.1-8B-Instruct-4bit',
    ];

    await db.from('conn_state').upsert({
      key: 'ark_mlx_models',
      value: knownModels,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    console.log('  MLX server not reachable — stored known models');
  }
}

async function syncAllModels() {
  await Promise.all([syncOllamaModels(), syncMlxModels()]);
  lastModelSync = Date.now();
}

// ── Main loop ──

async function main() {
  console.log(`\n⚡ Ark Runner started`);
  console.log(`  Supabase:   ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  Ollama:     ${OLLAMA_BASE}`);
  console.log(`  MLX:        ${MLX_BASE}`);
  console.log(`  Claude Max: via claude -p CLI (no API key)`);
  console.log(`  Polling every ${POLL_INTERVAL / 1000}s\n`);

  await syncAllModels();

  while (true) {
    try {
      // Pick up pending sessions
      const { data: pending } = await db
        .from('ark_sessions')
        .select('id, topic')
        .eq('status', 'pending')
        .order('created_at')
        .limit(1);

      if (pending && pending.length > 0) {
        const s = pending[0];
        console.log(`▶ Running: ${s.topic.slice(0, 80)}...`);
        await runSession(s.id);
        continue; // Check for more immediately
      }

      // Resume stuck sessions (running but no message in 5 min)
      const { data: stuck } = await db
        .from('ark_sessions')
        .select('id, topic, current_round')
        .eq('status', 'running')
        .order('created_at')
        .limit(1);

      if (stuck && stuck.length > 0) {
        const s = stuck[0];
        // Check if last message is older than threshold
        const { data: lastMsg } = await db
          .from('ark_messages')
          .select('created_at')
          .eq('session_id', s.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastTime = lastMsg?.[0]?.created_at ? new Date(lastMsg[0].created_at).getTime() : 0;
        if (Date.now() - lastTime > STUCK_THRESHOLD) {
          console.log(`▶ Resuming stuck session: ${s.topic.slice(0, 60)}... (round ${s.current_round})`);
          await runSession(s.id);
          continue;
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }

    // Periodic model sync
    if (Date.now() - lastModelSync > MODEL_SYNC_INTERVAL) {
      await syncAllModels();
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

main();
