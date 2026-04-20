const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | { type: string; text?: string; source?: unknown }[];
}

interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {},
): Promise<string> {
  const {
    model = 'claude-sonnet-4-20250514',
    maxTokens = 8192,
    temperature = 0.3,
    system,
  } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  return textBlock?.text ?? '';
}

export async function callClaudeJSON<T>(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {},
): Promise<T> {
  const text = await callClaude(messages, options);
  // Extract JSON from response (handles markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] ?? text).trim();
  return JSON.parse(jsonStr) as T;
}

export { type ClaudeMessage, type ClaudeOptions };
