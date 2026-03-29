// LLM provider — uses Ollama (OpenAI-compatible) for agent discussions

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
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${provider}/${model}): ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    tokens_used: data.usage?.total_tokens || 0,
    model,
  };
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
