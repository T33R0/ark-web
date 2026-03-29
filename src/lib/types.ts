export interface Agent {
  name: string;
  role: string; // e.g. "proposer", "adversary", "synthesizer"
  soul: string; // personality/system prompt
  model: string; // e.g. "qwen3:14b"
  provider: 'ollama' | 'openai';
  color?: string; // hex color for UI
}

export interface PhaseConfig {
  diverge: number;
  challenge: number;
  converge: number;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  agents: Agent[];
  phase_config: PhaseConfig;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  prompt: string;
  category: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme' | null;
  recommended_group_id: string | null;
  recommended_rounds: number;
  tags: string[];
  times_run: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  question_id: string | null;
  group_id: string | null;
  topic: string;
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'error';
  max_rounds: number;
  current_round: number;
  current_phase: string;
  phase_config: PhaseConfig | null;
  group_snapshot: { name: string; agents: Agent[] } | null;
  summary: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  agent_name: string;
  agent_role: string | null;
  round: number;
  phase: string | null;
  content: string;
  tokens_used: number | null;
  model: string | null;
  created_at: string;
}

// For creating/updating
export type GroupCreate = Pick<Group, 'name' | 'description' | 'agents' | 'phase_config'>;
export type QuestionCreate = Pick<Question, 'prompt' | 'category' | 'difficulty' | 'recommended_group_id' | 'recommended_rounds' | 'tags'>;
export type SessionCreate = {
  topic: string;
  group_id: string;
  question_id?: string;
  max_rounds: number;
};

export const CATEGORIES = [
  'strategic',
  'philosophical',
  'technical',
  'adversarial',
  'creative',
  'analytical',
] as const;

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'] as const;

export const AGENT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];
