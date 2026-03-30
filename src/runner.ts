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

  if (history.length > 0) {
    prompt += '\n\n--- CONVERSATION SO FAR ---\n';
    let currentRound = 0;
    for (const msg of history) {
      if (msg.round !== currentRound) {
        currentRound = msg.round;
        prompt += `\n[Round ${currentRound}${msg.phase ? ` - ${msg.phase.toUpperCase()}` : ''}]\n`;
      }
      prompt += `${msg.agent_name}: ${msg.content}\n`;
    }
  }

  prompt += `\n--- YOUR TURN ---\nRespond as ${agent.name}. Stay in character. Do NOT prefix your response with your name or role — just speak directly.`;
  return prompt;
}

// ── LLM call (routes to provider based on agent config) ──

import { callLLM as callLLMLib } from './lib/llm.js';

async function callLLM(provider: string, model: string, systemPrompt: string, userMessage: string): Promise<{ content: string; tokens: number }> {
  const result = await callLLMLib(provider, model, systemPrompt, userMessage);
  return { content: result.content, tokens: result.tokens_used };
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
          tokens_used: response.tokens,
          model: agent.model,
        });

        history.push({ agent_name: agent.name, content: response.content, round, phase });
      }
    }

    await db.from('ark_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`  ✓ Session completed`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`  ✗ Error: ${msg}`);
    await db.from('ark_sessions').update({ status: 'error', error_message: msg, completed_at: new Date().toISOString() }).eq('id', sessionId);
  }
}

// ── Main loop ──

async function main() {
  console.log(`\n⚡ Ark Runner started`);
  console.log(`  Supabase:   ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  Ollama:     ${OLLAMA_BASE}`);
  console.log(`  Anthropic:  ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'not set'}`);
  console.log(`  Polling every ${POLL_INTERVAL / 1000}s\n`);

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

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

main();
