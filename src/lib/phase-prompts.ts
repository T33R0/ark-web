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
You MUST directly engage with a specific claim from another agent. Reference the agent by name within your response. Then explain precisely why it's wrong, incomplete, or naive — OR why it's stronger than others realize. You MUST ALSO propose a counter-solution: "Instead of X, we should do Y because Z." Don't just poke holes — offer a better path. Do NOT simply restate your own diverge-phase position. Do NOT introduce entirely new topics. If you don't reference another agent by name AND propose a counter-approach, you have failed this round.

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
State your final position after hearing all arguments. What changed your mind? What do you still believe despite pushback? What is the single most important thing this group should do? CRITICAL: Your conclusion MUST be different from at least one other agent's final position. If you find yourself agreeing with everyone, you're converging too soon — defend the position nobody else is defending. Real convergence means some ideas WIN and others LOSE, not everyone agreeing.

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

  prompt += `\n--- YOUR TURN ---\nRespond as ${agent.name}. Stay in character. Do NOT prefix your response with your name. Do NOT include meta-commentary about the discussion format. CRITICAL: Do NOT start your response the same way you started a previous response. Vary your opening, structure, and approach each round. Just speak your position directly.`;

  return prompt;
}
