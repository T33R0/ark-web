import { Agent } from './types';

export function getPhaseInstructions(phase: string, agent: Agent, allAgents: Agent[]): string {
  const others = allAgents.filter(a => a.name !== agent.name);
  const otherNames = others.map(a => `${a.name} (${a.role})`).join(', ');

  const baseContext = `You are ${agent.name}. Your role: ${agent.role}.\nOther participants: ${otherNames}`;

  switch (phase) {
    case 'diverge':
      return `${baseContext}

PHASE: DIVERGE
Your goal is to generate a distinct, original perspective on the topic. Do NOT agree with or build on what others have said yet — bring something genuinely new. Be bold, specific, and different from the other participants. Draw on your unique role as ${agent.role} to offer a perspective only you would have.

Keep your response focused and under 200 words.`;

    case 'challenge':
      return `${baseContext}

PHASE: CHALLENGE
You must directly engage with specific claims made by other agents. Reference their names and what they said. Explain why their position is wrong, incomplete, or naive — OR strengthen it with evidence they missed. No new topics — only critique, counterargument, defense, and refinement of existing positions.

Be specific. Quote or paraphrase what you're responding to. Don't be polite about it — be rigorous.

Keep your response focused and under 200 words.`;

    case 'converge':
      if (agent.role === 'synthesizer' || agent.role === 'judge') {
        return `${baseContext}

PHASE: CONVERGE (You are the synthesizer)
Evaluate the entire discussion. Your job:
1. What positions survived scrutiny? What was eliminated?
2. What's the strongest conclusion the group can draw?
3. What tensions remain unresolved?
4. Rate the quality of the discussion (did agents actually engage, or just talk past each other?)

Be definitive. Take a stand. Under 250 words.`;
      }
      return `${baseContext}

PHASE: CONVERGE
The discussion is concluding. State your final position, incorporating what you learned from the challenges. What did you change your mind about? What do you still believe despite pushback? Be specific about what swayed you (or didn't).

Keep your response focused and under 200 words.`;

    default:
      return baseContext;
  }
}

export function buildAgentPrompt(
  agent: Agent,
  allAgents: Agent[],
  topic: string,
  phase: string,
  history: { agent_name: string; content: string; round: number; phase: string | null }[]
): string {
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

  prompt += `\n--- YOUR TURN ---\nRespond as ${agent.name}. Stay in character.`;

  return prompt;
}
