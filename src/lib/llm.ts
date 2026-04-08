// LLM provider — routes to Ollama, OpenAI, or Claude Max (via CLI)

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir, homedir } from 'os';

// Resolve claude binary path at module load (same pattern as claude-runner.mjs)
let CLAUDE_BIN = 'claude';
try {
  CLAUDE_BIN = execSync('which claude', { encoding: 'utf-8', timeout: 5000 }).trim();
} catch {
  const fallback = resolve(homedir(), '.local/bin/claude');
  try { execSync(`test -x "${fallback}"`, { timeout: 2000 }); CLAUDE_BIN = fallback; } catch {}
}

export interface LLMResponse {
  content: string;
  thinking: string | null;
  tokens_used: number;
  model: string;
}

export async function callLLM(
  provider: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  if (provider === 'anthropic') {
    return callClaudeMax(model, systemPrompt, userMessage);
  }
  return callOpenAICompatible(provider, model, systemPrompt, userMessage);
}

/**
 * Separate thinking from content — preserve both instead of stripping.
 * Thinking is stored in a separate column on ark_messages.
 */
function separateThinking(raw: string): { thinking: string | null; content: string } {
  if (!raw) return { thinking: null, content: '' };

  // Handle explicit <think> tags
  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>\s*([\s\S]*)/);
  if (thinkMatch) {
    return {
      thinking: thinkMatch[1].trim() || null,
      content: thinkMatch[2].trim(),
    };
  }

  // Handle unclosed <think> tag (model didn't close it)
  const unclosedMatch = raw.match(/^<think>([\s\S]*)$/);
  if (unclosedMatch) {
    return { thinking: unclosedMatch[1].trim(), content: '' };
  }

  // No think tags — return as-is
  return { thinking: null, content: raw };
}

// Ollama and OpenAI both use OpenAI-compatible chat/completions format
async function callOpenAICompatible(
  provider: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(provider);

  // Qwen3.5 thinking models: disable thinking at request level to get clean content
  // The model can't manage its thinking budget and produces infinite reasoning otherwise
  const isThinkingModel = model.includes('Qwen3.5') || model.includes('qwen3.5');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.7,
      repetition_penalty: 1.05,
      // Disable thinking at request level for thinking models
      ...(isThinkingModel ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${provider}/${model}): ${response.status} ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0]?.message;
  const rawContent = (message?.content || '').trim();
  const apiReasoning = (message?.reasoning || '').trim();

  // Separate any leaked thinking from content (preserve, don't strip)
  const { thinking: inlineThinking, content } = separateThinking(rawContent);
  // Merge: prefer inline thinking, fall back to API reasoning field
  const thinking = inlineThinking || apiReasoning || null;

  return {
    content,
    thinking,
    tokens_used: data.usage?.total_tokens || 0,
    model,
  };
}

/**
 * Call Claude via `claude -p` CLI — uses Claude Max plan directly.
 * Zero API keys needed. Runs through the local Claude CLI binary.
 * Same pattern used by Telegram poller, Discord bot, and all local Conn processes.
 */
function callClaudeMax(
  model: string,
  systemPrompt: string,
  userMessage: string
): LLMResponse {
  const prompt = `${systemPrompt}\n\n---\n\n${userMessage}`;
  const tmpFile = resolve(tmpdir(), `ark-llm-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);

  try {
    writeFileSync(tmpFile, prompt);

    // --tools "" prevents loading MCP servers and CLAUDE.md
    // cwd=/tmp avoids loading project-level configs
    const raw = execSync(
      `cat "${tmpFile}" | "${CLAUDE_BIN}" -p --output-format json --model ${model} --tools ""`,
      {
        cwd: tmpdir(),
        timeout: 120000, // 2 min per agent turn
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Parse JSON output from claude CLI
    const parsed = JSON.parse(raw);
    const usage = parsed.usage || {};
    const tokens_used = (usage.input_tokens || 0) + (usage.output_tokens || 0);

    return {
      content: parsed.result || '',
      thinking: null,
      tokens_used,
      model,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Claude CLI error (${model}): ${message.substring(0, 300)}`);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

function getBaseUrl(provider: string): string {
  switch (provider) {
    case 'ollama':
      return process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    case 'mlx':
      return process.env.MLX_BASE_URL || 'http://localhost:8080/v1';
    case 'openai':
      return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    default:
      return process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  }
}
