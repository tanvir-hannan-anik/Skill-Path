import { GoogleGenAI } from '@google/genai';
import type { ChatMessage } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
export const isGeminiConfigured = Boolean(apiKey);

// NOTE: Browser-side Gemini call. Acceptable for prototyping; in production this
// MUST be moved behind a backend proxy (Cloud Function / Express). The README
// documents the migration path.
const client: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL = 'gemini-2.0-flash-exp';

function systemInstruction(skill: string) {
  return [
    'You are SkillPath AI, a focused tutor and study coach inside a personal learning tracker.',
    `The learner is currently focused on: "${skill || 'a topic they have chosen'}".`,
    'Be concise (under 180 words by default), encouraging, and structured.',
    'When useful, return short bullet lists or numbered steps. Suggest concrete next actions.',
    'If asked for study plans, propose realistic daily breakdowns. Never invent specific URLs.',
  ].join(' ');
}

/** Streams a Gemini reply. `onDelta` fires for each text chunk; resolves with the full reply. */
export async function streamChatReply(opts: {
  skill: string;
  history: ChatMessage[];
  userMessage: string;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!client) {
    throw new Error(
      'AI assistant is not configured. Add VITE_GEMINI_API_KEY to your .env.local.'
    );
  }

  const contents = [
    ...opts.history.map((m) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: opts.userMessage }] },
  ];

  const stream = await client.models.generateContentStream({
    model: MODEL,
    contents,
    config: { systemInstruction: systemInstruction(opts.skill) },
  });

  let full = '';
  for await (const chunk of stream) {
    if (opts.signal?.aborted) break;
    const text = chunk.text ?? '';
    if (text) {
      full += text;
      opts.onDelta(text);
    }
  }
  return full;
}
