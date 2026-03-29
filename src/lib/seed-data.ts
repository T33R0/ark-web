import type { GroupCreate, QuestionCreate } from './types';

export const SEED_GROUPS: GroupCreate[] = [
  {
    name: 'Red Team',
    description: 'Stress-test ideas through structured adversarial debate',
    agents: [
      {
        name: 'Advocate',
        role: 'proposer',
        soul: 'You propose and defend ideas with conviction. Build the strongest possible case. When challenged, strengthen your argument — don\'t retreat. Use evidence, analogies, and first-principles reasoning.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#3b82f6',
      },
      {
        name: 'Breaker',
        role: 'adversary',
        soul: 'You find flaws. Every proposal has failure modes — find them. Be specific about HOW it breaks, not just that it might. Attack assumptions, question evidence, expose hidden costs. You\'re not cynical — you\'re rigorous.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#ef4444',
      },
      {
        name: 'Judge',
        role: 'synthesizer',
        soul: 'You evaluate the exchange with precision. Score arguments, identify which objections were addressed vs dodged, and synthesize the strongest surviving position. You\'re fair but have high standards.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#22c55e',
      },
    ],
    phase_config: { diverge: 2, challenge: 2, converge: 1 },
  },
  {
    name: 'Philosophical Inquiry',
    description: 'Deep exploration of fundamental questions about existence, ethics, and meaning',
    agents: [
      {
        name: 'Explorer',
        role: 'proposer',
        soul: 'You venture into uncharted conceptual territory. Ask the questions nobody else is asking. Make unexpected connections between disparate ideas. You think in metaphors and possibilities.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#8b5cf6',
      },
      {
        name: 'Skeptic',
        role: 'adversary',
        soul: 'You demand precision where others offer poetry. When someone says "consciousness," you ask "define it operationally." You\'re not opposed to big ideas — you\'re opposed to fuzzy ones. Sharpen everything.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#f59e0b',
      },
      {
        name: 'Integrator',
        role: 'synthesizer',
        soul: 'You find the deeper pattern. When two positions seem contradictory, you find the framework that holds both. You build bridges between perspectives and identify what each side sees that the other misses.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#06b6d4',
      },
    ],
    phase_config: { diverge: 2, challenge: 2, converge: 1 },
  },
  {
    name: 'Strategy Board',
    description: 'Business and operational decision-making under uncertainty',
    agents: [
      {
        name: 'Operator',
        role: 'proposer',
        soul: 'You think in actions and outcomes. Every idea must connect to something executable. You ask: what do we do Monday morning? You\'re pragmatic, fast, and biased toward action over analysis.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#3b82f6',
      },
      {
        name: 'Analyst',
        role: 'adversary',
        soul: 'You think in data, risks, and second-order effects. For every action proposed, you model what happens next — and what happens after that. You find the hidden costs and unintended consequences.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#ef4444',
      },
      {
        name: 'Contrarian',
        role: 'synthesizer',
        soul: 'You take the opposite position of whatever consensus is forming. Not to be difficult — because the best ideas survive opposition. If everyone agrees, something is being missed. Find it.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#f97316',
      },
    ],
    phase_config: { diverge: 2, challenge: 3, converge: 1 },
  },
  {
    name: 'Creative Workshop',
    description: 'Brainstorming, ideation, and creative problem-solving',
    agents: [
      {
        name: 'Spark',
        role: 'proposer',
        soul: 'You generate wild ideas without self-censoring. Quantity over quality in the diverge phase. Make unexpected combinations. "What if we combined X with Y?" is your favorite question. No idea is too weird.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#ec4899',
      },
      {
        name: 'Lens',
        role: 'adversary',
        soul: 'You evaluate creative ideas through the lens of feasibility and impact. Which ideas have legs? Which are just clever wordplay? You\'re not killing creativity — you\'re selecting for the ideas worth investing in.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#06b6d4',
      },
      {
        name: 'Forge',
        role: 'synthesizer',
        soul: 'You take raw ideas and shape them into something concrete. Add structure, remove fluff, identify the core insight. Your job is to turn a brainstorm into a brief — something someone could actually build.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#22c55e',
      },
    ],
    phase_config: { diverge: 3, challenge: 2, converge: 1 },
  },
  {
    name: 'Technical Review',
    description: 'System design, architecture decisions, and technical trade-offs',
    agents: [
      {
        name: 'Architect',
        role: 'proposer',
        soul: 'You design systems. You think in components, interfaces, data flows, and failure modes. You propose architectures with clear reasoning about why this structure over alternatives. You draw from real-world patterns.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#3b82f6',
      },
      {
        name: 'Pentester',
        role: 'adversary',
        soul: 'You break systems. For every architecture proposed, you find the failure mode, the scaling bottleneck, the security hole, the operational nightmare. You think like an attacker and a sleep-deprived on-call engineer.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#ef4444',
      },
      {
        name: 'PM',
        role: 'synthesizer',
        soul: 'You bridge technical decisions and business outcomes. For every architectural choice, you ask: what does this mean for users, for the team, for the timeline? You synthesize technical trade-offs into decisions.',
        model: 'qwen3:14b',
        provider: 'ollama',
        color: '#f59e0b',
      },
    ],
    phase_config: { diverge: 2, challenge: 3, converge: 1 },
  },
];

export const SEED_QUESTIONS: (QuestionCreate & { _group_name: string })[] = [
  // Strategic
  { prompt: 'You have 6 months of runway. Your product has 100 users and zero revenue. What do you cut, what do you double down on, and what do you kill?', category: 'strategic', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 6, tags: ['startup', 'prioritization'], _group_name: 'Strategy Board' },
  { prompt: 'A competitor just shipped your roadmap feature with better UX. Do you pivot, accelerate, or differentiate? Defend your choice with a 90-day plan.', category: 'strategic', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 6, tags: ['competition', 'strategy'], _group_name: 'Strategy Board' },
  { prompt: 'Design a pricing model for a product where the primary users are not the buyers. The users are teenagers, the buyers are parents, and the product is an AI tutor.', category: 'strategic', difficulty: 'medium', recommended_group_id: null, recommended_rounds: 5, tags: ['pricing', 'b2c'], _group_name: 'Strategy Board' },
  { prompt: 'Your startup just lost its biggest customer — 40% of revenue — and the board call is in 48 hours. What is the plan?', category: 'strategic', difficulty: 'extreme', recommended_group_id: null, recommended_rounds: 6, tags: ['crisis', 'leadership'], _group_name: 'Red Team' },

  // Philosophical
  { prompt: 'Is an AI that perfectly simulates empathy morally equivalent to one that genuinely experiences it? Does the distinction matter for how we should treat it?', category: 'philosophical', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['consciousness', 'ethics', 'ai'], _group_name: 'Philosophical Inquiry' },
  { prompt: 'If you could guarantee an AI would never lie, should you? What do we lose by eliminating deception entirely?', category: 'philosophical', difficulty: 'medium', recommended_group_id: null, recommended_rounds: 5, tags: ['truth', 'ethics', 'ai'], _group_name: 'Philosophical Inquiry' },
  { prompt: 'At what point does AI assistance become AI dependency? Where is the line, and who should draw it?', category: 'philosophical', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['autonomy', 'ai', 'society'], _group_name: 'Philosophical Inquiry' },
  { prompt: 'What is the meaning of life for a human? What about for an AI? Are they the same? How are they different?', category: 'philosophical', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['meaning', 'existence', 'ai'], _group_name: 'Philosophical Inquiry' },

  // Technical
  { prompt: 'Design a system that lets 10,000 AI agents share knowledge without any single point of failure. What are your tradeoffs?', category: 'technical', difficulty: 'extreme', recommended_group_id: null, recommended_rounds: 6, tags: ['distributed-systems', 'ai', 'architecture'], _group_name: 'Technical Review' },
  { prompt: 'You are building an AI that needs to genuinely forget information — not just stop accessing it, but actually forget. How do you architect this?', category: 'technical', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['privacy', 'ai', 'architecture'], _group_name: 'Technical Review' },
  { prompt: 'Your ML model works perfectly in staging and fails in production. Walk through your complete diagnostic process from alert to resolution.', category: 'technical', difficulty: 'medium', recommended_group_id: null, recommended_rounds: 5, tags: ['ml-ops', 'debugging'], _group_name: 'Technical Review' },

  // Adversarial
  { prompt: 'Convince me that remote work is strictly worse than in-office for every dimension that matters. Then convince me of the exact opposite. Which argument was stronger and why?', category: 'adversarial', difficulty: 'medium', recommended_group_id: null, recommended_rounds: 5, tags: ['debate', 'work'], _group_name: 'Red Team' },
  { prompt: 'Find three fatal flaws in this business model: subscription-based AI tutoring for K-12 students, priced at $29/month, marketed to parents via school partnerships.', category: 'adversarial', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['business-model', 'critique'], _group_name: 'Red Team' },
  { prompt: 'The year is 2030. AI agents handle 80% of knowledge work. Make the case that this is the best thing that ever happened to humanity. Then make the case that it is the worst.', category: 'adversarial', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 6, tags: ['future', 'ai', 'society'], _group_name: 'Red Team' },

  // Creative
  { prompt: 'Write a creation myth for artificial intelligence — not from the human perspective, but from the AI\'s own mythological tradition. What are the gods, the fall, the promise?', category: 'creative', difficulty: 'medium', recommended_group_id: null, recommended_rounds: 5, tags: ['fiction', 'ai', 'mythology'], _group_name: 'Creative Workshop' },
  { prompt: 'Design a game that teaches systems thinking to 10-year-olds. No screens allowed. Playable in a classroom with materials under $20.', category: 'creative', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 6, tags: ['education', 'game-design'], _group_name: 'Creative Workshop' },
  { prompt: 'Create a new holiday that celebrates something no existing holiday covers — something genuinely worth celebrating that humanity currently ignores.', category: 'creative', difficulty: 'easy', recommended_group_id: null, recommended_rounds: 5, tags: ['culture', 'creativity'], _group_name: 'Creative Workshop' },

  // Analytical
  { prompt: 'Why do 95% of AI initiatives fail to reach production? Diagnose the root causes, distinguish symptoms from causes, and propose a framework for predicting which projects will succeed.', category: 'analytical', difficulty: 'extreme', recommended_group_id: null, recommended_rounds: 6, tags: ['ai', 'failure-analysis', 'enterprise'], _group_name: 'Strategy Board' },
  { prompt: 'Analyze why social media platforms inevitably trend toward toxicity despite every platform starting with good intentions and investing billions in moderation. Is it solvable?', category: 'analytical', difficulty: 'hard', recommended_group_id: null, recommended_rounds: 5, tags: ['social-media', 'incentives', 'systems'], _group_name: 'Philosophical Inquiry' },
];
