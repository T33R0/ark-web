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
 * Strip untagged thinking that Qwen3.5 leaks without <think> tags.
 * Detects reasoning preamble patterns and extracts the actual response.
 */
function stripUntaggedThinking(content: string): string {
  if (!content) return content;

  // Pattern 1: Content starts with reasoning markers then transitions to actual response
  // e.g. "Let me think about this...\n\nOkay, here's my response..."
  const thinkingPrefixes = /^(?:(?:Let me|I need to|I'll|I should|First,? (?:let me|I'll|I need)|Okay,? (?:let me|so)|Hmm,?|Well,?|Alright,?)\s+(?:think|analyze|consider|break|reason|evaluate|assess|review|examine|process|work through|figure out|look at)[\s\S]*?\n\n)/i;
  const stripped = content.replace(thinkingPrefixes, '');
  if (stripped && stripped.length > 20) content = stripped;

  // Pattern 2: Numbered reasoning steps followed by actual response
  // e.g. "1. The topic is X\n2. Consider Y\n3. Therefore Z\n\nMy actual response..."
  const numberedReasoning = /^(?:\d+\.\s+.+\n){2,}(?:\n)+/;
  const afterNumbered = content.replace(numberedReasoning, '');
  if (afterNumbered && afterNumbered.length > 20 && afterNumbered.length < content.length * 0.85) {
    content = afterNumbered;
  }

  // Pattern 3: "**Thinking:**" or "**Analysis:**" header blocks
  content = content.replace(/^\*\*(?:Thinking|Analysis|Reasoning|Internal|Chain of thought|Planning|Assessment)\b[^*]*\*\*[:\s]*[\s\S]*?\n\n/i, '');

  // Pattern 4: Lines that are clearly meta-reasoning (not speaking in character)
  // Remove leading lines that reference "the prompt", "the question", "my role", "I need to respond"
  const lines = content.split('\n');
  let startIdx = 0;
  for (let i = 0; i < lines.length && i < 5; i++) {
    const line = lines[i].trim();
    if (!line) { startIdx = i + 1; continue; }
    if (/^(?:The (?:prompt|question|topic|user)|I (?:need to|should|must|will) (?:respond|answer|address|consider)|My role (?:is|here)|As (?:a |the )?(?:\w+ )?(?:agent|participant)|In this (?:phase|round|discussion))/i.test(line)) {
      startIdx = i + 1;
    } else {
      break;
    }
  }
  if (startIdx > 0) {
    const remaining = lines.slice(startIdx).join('\n').trim();
    if (remaining.length > 20) content = remaining;
  }

  return content.trim();
}

// Ollama and OpenAI both use OpenAI-compatible chat/completions format
async function callOpenAICompatible(
  provider: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(provider);

  // Qwen3.5 thinking models: disable thinking to get clean content output
  // /no_think tag prevents the model from generating reasoning tokens
  const isThinkingModel = model.includes('Qwen3.5') || model.includes('qwen3.5');
  const finalSystemPrompt = isThinkingModel
    ? `/no_think\n${systemPrompt}`
    : systemPrompt;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 512,
      temperature: 0.7,
      repetition_penalty: 1.1,
      ...(isThinkingModel ? { enable_thinking: false } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${provider}/${model}): ${response.status} ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0]?.message;
  // Prefer content over reasoning — reasoning is internal chain-of-thought
  let content = (message?.content || '').trim();
  // Strip <think>...</think> tags from /no_think responses (handles unclosed tags too)
  content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/g, '').trim();
  // Qwen3.5 leaks untagged thinking ~40% of the time — heuristic cleanup
  if (isThinkingModel) {
    content = stripUntaggedThinking(content);
  }
  if (!content && message?.reasoning) {
    // Extract just the final answer if thinking leaked into reasoning only
    const reasoning = message.reasoning as string;
    const lastParagraph = reasoning.split('\n\n').filter((p: string) => p.trim()).pop() || '';
    content = lastParagraph.replace(/<think>[\s\S]*?<\/think>\s*/g, '').replace(/<think>[\s\S]*$/g, '').trim();
    if (isThinkingModel) content = stripUntaggedThinking(content);
  }
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
