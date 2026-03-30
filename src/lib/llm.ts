// LLM provider — routes to Ollama, OpenAI, or Anthropic based on agent config

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
    return callAnthropic(model, systemPrompt, userMessage);
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

// Anthropic uses Messages API (different format from OpenAI)
async function callAnthropic(
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot use anthropic provider');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${model}): ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  const tokens_used = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  return { content, tokens_used, model };
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
