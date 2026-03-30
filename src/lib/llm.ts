// LLM provider — routes to Ollama, OpenAI, or Claude Max (via CLI)

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

export interface LLMResponse {
  content: string;
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

// Ollama and OpenAI both use OpenAI-compatible chat/completions format
async function callOpenAICompatible(
  provider: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(provider);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${provider}/${model}): ${response.status} ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0]?.message;
  // qwen3 uses thinking mode — content may be in `reasoning` field with empty `content`
  const content = message?.content || message?.reasoning || '';
  return {
    content,
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
      `cat "${tmpFile}" | claude -p --output-format json --model ${model} --tools ""`,
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
    case 'openai':
      return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    default:
      return process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  }
}
