import type { ChatMessage } from '../types';

const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
export const isGroqConfigured = Boolean(apiKey);

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function systemPrompt(skill: string): string {
  return [
    'You are SkillPath AI, a focused tutor and study coach inside a personal learning tracker.',
    `The learner is currently studying: "${skill || 'a topic they have chosen'}".`,
    'Be concise, warm, and practical. Default to under 200 words unless more detail is needed.',
    'Formatting rules you must always follow:',
    '- Use **bold** to highlight titles, section labels, and key terms.',
    '- Use plain dashes (-) for bullet lists.',
    '- Use numbered lists (1. 2. 3.) for steps.',
    '- Never use # symbols for headings.',
    '- Never use + or * as list markers.',
    '- Never use $ for code or any other purpose.',
    '- Never use markdown code fences (``` or `).',
    'When giving study plans, propose realistic daily breakdowns.',
    'Suggest concrete next actions. Never invent specific URLs.',
  ].join(' ');
}

/**
 * Streams a Groq LLM reply using the OpenAI-compatible SSE endpoint.
 * `onDelta` fires for each text chunk as it arrives.
 */
export async function streamGroqReply(opts: {
  skill: string;
  history: ChatMessage[];
  userMessage: string;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!apiKey) {
    throw new Error('AI assistant is not configured. Add VITE_GROQ_API_KEY to your .env.local.');
  }

  const messages = [
    { role: 'system', content: systemPrompt(opts.skill) },
    ...opts.history.map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    })),
    { role: 'user', content: opts.userMessage },
  ];

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (opts.signal?.aborted) { reader.cancel(); break; }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6)) as {
          choices?: { delta?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.delta?.content ?? '';
        if (text) {
          full += text;
          opts.onDelta(text);
        }
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }

  return full;
}
