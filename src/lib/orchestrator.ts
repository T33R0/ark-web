import { createServerClient } from './supabase';
import { callLLM } from './llm';
import { buildAgentPrompt } from './phase-prompts';
import { phaseForRound } from './utils';
import type { Agent, PhaseConfig, Session } from './types';

export async function runSession(sessionId: string): Promise<void> {
  const db = createServerClient();

  // Load session
  const { data: session, error: sessionError } = await db
    .from('ark_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const agents: Agent[] = session.group_snapshot?.agents || [];
  const phaseConfig: PhaseConfig = session.phase_config || { diverge: 2, challenge: 2, converge: 1 };
  const topic = session.topic;
  const maxRounds = session.max_rounds;

  if (agents.length === 0) {
    await db.from('ark_sessions').update({
      status: 'error',
      error_message: 'No agents configured',
      completed_at: new Date().toISOString()
    }).eq('id', sessionId);
    return;
  }

  // Mark as running
  await db.from('ark_sessions').update({
    status: 'running',
    started_at: new Date().toISOString()
  }).eq('id', sessionId);

  // Update question times_run
  if (session.question_id) {
    const { data: q } = await db.from('ark_questions').select('times_run').eq('id', session.question_id).single();
    if (q) {
      await db.from('ark_questions').update({ times_run: (q.times_run as number) + 1 }).eq('id', session.question_id);
    }
  }

  const history: { agent_name: string; content: string; round: number; phase: string | null }[] = [];

  try {
    for (let round = 1; round <= maxRounds; round++) {
      const phase = phaseForRound(round, phaseConfig);

      // Update session state
      await db.from('ark_sessions').update({
        current_round: round,
        current_phase: phase
      }).eq('id', sessionId);

      // Check if session was stopped
      const { data: current } = await db
        .from('ark_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (current?.status === 'stopped') {
        return;
      }

      for (const agent of agents) {
        const prompt = buildAgentPrompt(agent, agents, topic, phase, history);

        const response = await callLLM(
          agent.provider,
          agent.model,
          prompt,
          `Round ${round}, Phase: ${phase}. Respond as ${agent.name}.`
        );

        // Insert message
        await db.from('ark_messages').insert({
          session_id: sessionId,
          agent_name: agent.name,
          agent_role: agent.role,
          round,
          phase,
          content: response.content,
          thinking: response.thinking || null,
          tokens_used: response.tokens_used,
          model: response.model,
        });

        // Track for context
        history.push({
          agent_name: agent.name,
          content: response.content,
          round,
          phase,
        });
      }
    }

    // Mark complete
    await db.from('ark_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString()
    }).eq('id', sessionId);

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await db.from('ark_sessions').update({
      status: 'error',
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    }).eq('id', sessionId);
    throw err;
  }
}
