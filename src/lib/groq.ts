import type { ChatMessage, GeneratedTask, QuizQuestion, StudyPack, PracticeProblem } from '../types';

const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const studyPackApiKey = (import.meta.env.VITE_GROQ_STUDYPACK_API_KEY as string | undefined) || apiKey;
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

async function groqJSON<T>(messages: { role: string; content: string }[], maxTokens = 2048): Promise<T> {
  if (!apiKey) throw new Error('AI not configured. Add VITE_GROQ_API_KEY to .env.local.');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response.');
  try { return JSON.parse(content) as T; } catch { throw new Error('AI returned malformed JSON. Try again.'); }
}

async function groqText(messages: { role: string; content: string }[], maxTokens = 1024): Promise<string> {
  if (!apiKey) throw new Error('AI not configured. Add VITE_GROQ_API_KEY to .env.local.');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.8, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI returned an empty response.');
  return text;
}

export async function generateQuiz(topic: string, count: number = 5): Promise<QuizQuestion[]> {
  const n = Math.max(1, Math.min(count, 10));
  const result = await groqJSON<{ questions?: QuizQuestion[] } | QuizQuestion[]>([
    { role: 'system', content: 'You are a quiz generator. Always return valid JSON.' },
    {
      role: 'user',
      content: `Generate ${n} multiple-choice quiz questions about: "${topic}".

Return a JSON object: {"questions": [...]}
Each question object must have:
- "q": the question text (string)
- "choices": exactly 4 answer options (array of 4 strings)
- "answer": 0-indexed integer of the correct choice (0, 1, 2, or 3)
- "explanation": 1-2 sentence explanation of the correct answer (string)`,
    },
  ], 2048);
  const questions = Array.isArray(result) ? result : ((result as { questions?: QuizQuestion[] }).questions ?? []);
  return questions.slice(0, n) as QuizQuestion[];
}

export async function generateTasks(topic: string): Promise<GeneratedTask[]> {
  const result = await groqJSON<{ tasks?: Omit<GeneratedTask, 'id'>[] } | Omit<GeneratedTask, 'id'>[]>([
    { role: 'system', content: 'You are a curriculum designer. Always return valid JSON.' },
    {
      role: 'user',
      content: `Generate exactly 3 practical hands-on tasks for someone studying: "${topic}".

Return a JSON object: {"tasks": [...]}
Each task object must have:
- "title": a concise task title (string)
- "description": 2-3 sentences describing what to do (string)
- "difficulty": exactly one of "Easy", "Medium", or "Hard" (string)

Make task 1 Easy (~30 min), task 2 Medium (~1 hr), task 3 Hard (~2 hr).`,
    },
  ], 1024);
  const raw = Array.isArray(result) ? result : ((result as { tasks?: Omit<GeneratedTask, 'id'>[] }).tasks ?? []);
  return (raw as Omit<GeneratedTask, 'id'>[]).map((t, i) => ({
    ...t,
    id: `gen_${Date.now()}_${i}`,
    difficulty: t.difficulty as GeneratedTask['difficulty'],
  }));
}

export async function generateWeeklyProject(skill: string, topics: string[]): Promise<string> {
  if (!topics.length) throw new Error('No topics this week yet — add some learning content first.');
  return groqText([
    { role: 'system', content: 'You are a curriculum designer who creates hands-on project assignments. Use Markdown formatting.' },
    {
      role: 'user',
      content: [
        `The learner is studying: "${skill}".`,
        'Topics covered this week:',
        ...topics.map(t => `- ${t}`),
        '',
        'Design ONE substantial weekly project that synthesises these topics.',
        'Requirements: 2–4 hours of work, hands-on, produces a tangible artifact (small app, document, or design), clear acceptance criteria.',
        'Format with these Markdown sections: ## Overview, ## Requirements (bulleted list), ## Stretch Goals, ## How to Submit.',
        'Keep it under 400 words. Do not invent URLs.',
      ].join('\n'),
    },
  ], 1024);
}

// ---- Study Pack (dedicated second Groq key) --------------------------------

function studyPackIdHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  return `doc_${Math.abs(hash).toString(36)}`;
}

async function groqJSONWithKey<T>(key: string, messages: { role: string; content: string }[], maxTokens = 3000): Promise<T> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response.');
  try { return JSON.parse(content) as T; } catch { throw new Error('AI returned malformed JSON. Try again.'); }
}

/** Fetches the raw text of a documentation page via a CORS proxy. Returns null on failure. */
async function fetchDocText(url: string): Promise<string | null> {
  const proxies = [
    { url: `https://corsproxy.io/?url=${encodeURIComponent(url)}`, json: false },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, json: true },
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const html: string = proxy.json
        ? ((await res.json()) as { contents?: string }).contents ?? ''
        : await res.text();
      if (!html || html.length < 200) continue;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,nav,header,footer,aside,[role="navigation"],[role="banner"],[role="complementary"]').forEach((el) => el.remove());
      const text = (doc.body?.innerText ?? doc.documentElement.innerText ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 200) return text.slice(0, 10000);
    } catch {
      // try next proxy
    }
  }
  return null;
}

export async function generateStudyPackViaGroq(docUrl: string, docTitle: string): Promise<StudyPack> {
  if (!studyPackApiKey) throw new Error('Study pack AI not configured. Add VITE_GROQ_STUDYPACK_API_KEY to .env.local.');

  type RawPack = {
    summary?: string;
    conceptList?: string[];
    readingMinutes?: number;
    assignments?: string[];
  };

  // Attempt to fetch the real page content so Groq can summarise it accurately.
  const docText = await fetchDocText(docUrl);

  const systemMsg = [
    'You are a senior technical educator.',
    'Given documentation content (or a URL + title if content is unavailable), produce a JSON study pack with:',
    '  summary: a clear 4–6 paragraph summary of the page content written in plain English (what it covers, key points, how things work)',
    '  conceptList: 3–8 key concept strings extracted from the content',
    '  readingMinutes: estimated reading time as a number',
    '  assignments: exactly 2 practical hands-on assignment strings a learner can do after reading',
    'Return ONLY valid JSON. No prose outside JSON.',
  ].join(' ');

  const userMsg = docText
    ? `URL: ${docUrl}\nTitle: ${docTitle}\n\nPage content:\n${docText}\n\nReturn JSON only.`
    : `URL: ${docUrl}\nTitle: ${docTitle}\n\nNo page content available — use your knowledge of this topic.\n\nReturn JSON only.`;

  const result = await groqJSONWithKey<RawPack>(studyPackApiKey, [
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg },
  ], 3000);

  return {
    id: studyPackIdHash(docUrl),
    docUrl,
    docTitle,
    generatedAt: Date.now(),
    summary: result.summary ?? '',
    conceptList: result.conceptList ?? [],
    readingMinutes: result.readingMinutes ?? 10,
    assignments: (result.assignments ?? []).slice(0, 2),
  };
}

// ---- Code Tutor: execution trace generation --------------------------------

export interface TraceFrame {
  /** "global" or the function name. */
  name: string;
  /** Variable name → string-rendered value. References point at heap keys. */
  locals: Record<string, string>;
  /** Set on the active frame once it has returned. */
  returnValue?: string | null;
}

export interface HeapObject {
  /** "list" | "tuple" | "dict" | "object" | "set" | ... */
  type: string;
  /** For list/tuple/set: the element values, in order. */
  items?: string[];
  /** For dict/object: key/field → value. */
  entries?: Record<string, string>;
  /** For object instances: the class name. */
  className?: string;
}

export interface TraceStep {
  step: number;
  /** 1-based source line being executed at this step. */
  line: number;
  event: string; // 'call' | 'step' | 'return'
  frames: TraceFrame[];
  heap?: Record<string, HeapObject>;
  /** Accumulated program output up to and including this step. */
  stdout: string;
  returnValue?: string | null;
}

function tracerPrompt(code: string, langName: string): string {
  return [
    `You are a ${langName} execution tracer. Simulate running the code below step by step,`,
    'exactly like Python Tutor. Return ONLY a JSON object of this shape:',
    '{ "steps": [ { "step": 1, "line": 3, "event": "call"|"step"|"return",',
    '  "frames": [ { "name": "global"|"funcName", "locals": { "x": "5" }, "returnValue": null } ],',
    '  "heap": { "ref_1": { "type": "list", "items": ["1","2","3"] },',
    '            "ref_2": { "type": "dict", "entries": { "a": "1" } },',
    '            "ref_3": { "type": "object", "className": "Node", "entries": { "val": "1", "next": "ref_4" } } },',
    '  "stdout": "accumulated output so far", "returnValue": null } ] }',
    'Rules:',
    '- Number steps from 1. Include every executed line, every call, and every return.',
    '- Frames are ordered bottom (global) to top (most recent call). For recursion, stack multiple frames.',
    '- All values in "locals", "items", and "entries" must be strings.',
    '- When a variable holds a list/dict/tuple/set/object, store the object in "heap" and set the variable value to its ref key (e.g. "ref_1").',
    '- Only include "heap" entries that actually exist at that step.',
    '- "stdout" is the FULL output printed so far (append each print / console.log / printf / cout / System.out.print[ln]), not just the latest line.',
    '- Maximum 40 steps. If the program is longer, stop early at a sensible point.',
    'Do not include any prose, comments, or markdown — JSON object only.',
    '',
    `${langName} CODE TO TRACE:`,
    code,
  ].join('\n');
}

/** Generates a step-by-step execution trace for the given code via Groq. */
const LANG_NAMES: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

export async function traceCode(code: string, language: string): Promise<TraceStep[]> {
  if (!apiKey) throw new Error('AI not configured. Add VITE_GROQ_API_KEY to .env.local.');
  const langName = LANG_NAMES[language] ?? 'Python';

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: `You are a precise ${langName} execution tracer. Output only JSON.` },
        { role: 'user', content: tracerPrompt(code, langName) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 6000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response.');

  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('Could not parse trace. Try simpler code.'); }
  const steps = Array.isArray(parsed)
    ? (parsed as TraceStep[])
    : ((parsed as { steps?: TraceStep[] }).steps ?? []);
  if (!steps.length) throw new Error('Could not parse trace. Try simpler code.');
  return steps.slice(0, 40);
}

/** Runs code on the public Piston API to capture real stdout. Returns null on failure. */
export async function runViaPiston(code: string, language: string): Promise<string | null> {
  const map: Record<string, { language: string; version: string }> = {
    python: { language: 'python', version: '3.10.0' },
    javascript: { language: 'javascript', version: '18.15.0' },
    c: { language: 'c', version: '10.2.0' },
    cpp: { language: 'c++', version: '10.2.0' },
    java: { language: 'java', version: '15.0.2' },
  };
  const cfg = map[language] ?? map.python;
  try {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: cfg.language,
        version: cfg.version,
        files: [{ content: code }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { run?: { stdout?: string; stderr?: string; output?: string } };
    const run = data.run;
    if (!run) return null;
    return (run.output ?? `${run.stdout ?? ''}${run.stderr ?? ''}`).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Streams a Groq reply with a caller-supplied system prompt (used by the Code Tutor chat).
 */
export async function streamGroqChat(opts: {
  system: string;
  history: ChatMessage[];
  userMessage: string;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!apiKey) throw new Error('AI assistant is not configured. Add VITE_GROQ_API_KEY to your .env.local.');

  const messages = [
    { role: 'system', content: opts.system },
    ...opts.history.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: opts.userMessage },
  ];

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, stream: true, temperature: 0.6, max_tokens: 1024 }),
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
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6)) as { choices?: { delta?: { content?: string } }[] };
        const text = json.choices?.[0]?.delta?.content ?? '';
        if (text) { full += text; opts.onDelta(text); }
      } catch { /* skip malformed SSE chunk */ }
    }
  }
  return full;
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
