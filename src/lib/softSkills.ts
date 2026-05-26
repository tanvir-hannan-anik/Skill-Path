import { supabase, isSupabaseConfigured } from './supabase';

const apiKey = import.meta.env.VITE_GROQ_STUDYPACK_API_KEY as string | undefined;
export const isSoftSkillsConfigured = Boolean(apiKey);

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ---- Types ------------------------------------------------------------------

export interface VocabWord {
  word: string;
  partOfSpeech: string;
  banglaMeaning: string;
  exampleSentence: string;
}

export interface VoiceStory {
  title: string;
  text: string;
}

export interface StoryHistoryEntry {
  date: string;
  title: string;
  text: string;
}

// ---- Groq JSON helper -------------------------------------------------------

async function groqJSON<T>(
  systemInstruction: string,
  userPrompt: string,
  maxTokens = 2048,
): Promise<T> {
  if (!apiKey) throw new Error('Groq not configured. Add VITE_GROQ_STUDYPACK_API_KEY to .env.local.');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Groq API error ${res.status}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response.');
  try { return JSON.parse(content) as T; } catch { throw new Error('Groq returned malformed JSON. Try again.'); }
}

// ---- Daily Story -------------------------------------------------------------

const STORY_LS_PREFIX = 'skillpath:daily-story:';

export async function getDailyStory(date: string): Promise<VoiceStory> {
  // 1. Supabase (primary source — shared for all users)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('soft_skill_stories')
        .select('title, story_text')
        .eq('date', date)
        .maybeSingle();
      if (data) return { title: data.title, text: data.story_text };
    } catch { /* fall through */ }
  }

  // 2. localStorage cache
  try {
    const raw = localStorage.getItem(STORY_LS_PREFIX + date);
    if (raw) return JSON.parse(raw) as VoiceStory;
  } catch { /* ignore */ }

  // 3. Generate via Gemini
  const story = await groqJSON<VoiceStory>(
    'You are an English speaking trainer. Return valid JSON only.',
    `Generate a short story for English speaking practice (date: ${date}).
Return JSON: {"title": "...", "text": "..."}
Requirements:
- The text must be exactly 4-5 sentences
- Clear, natural English at an intermediate level
- Engaging everyday topic (daily life, travel, friendship, or inspiration)
- Pleasant rhythm — good to read aloud`,
    512,
  );

  // 4. Persist
  try { localStorage.setItem(STORY_LS_PREFIX + date, JSON.stringify(story)); } catch { /* quota */ }
  if (isSupabaseConfigured) {
    try {
      await supabase.from('soft_skill_stories').upsert({
        date,
        title: story.title,
        story_text: story.text,
      });
    } catch { /* non-fatal */ }
  }

  return story;
}

export async function getStoryHistory(limit = 14): Promise<StoryHistoryEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('soft_skill_stories')
        .select('date, title, story_text')
        .order('date', { ascending: false })
        .limit(limit);
      return (data ?? []).map((r) => ({
        date: r.date as string,
        title: r.title as string,
        text: r.story_text as string,
      }));
    } catch { /* fall through */ }
  }

  // Fallback: scan localStorage
  const entries: StoryHistoryEntry[] = [];
  for (let i = 1; i <= limit; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const raw = localStorage.getItem(STORY_LS_PREFIX + date);
      if (raw) {
        const s = JSON.parse(raw) as VoiceStory;
        entries.push({ date, title: s.title, text: s.text });
      }
    } catch { /* ignore */ }
  }
  return entries;
}

// ---- Daily Vocabulary -------------------------------------------------------

const VOCAB_LS_PREFIX = 'skillpath:daily-vocab:';

export async function getDailyVocabulary(date: string): Promise<VocabWord[]> {
  // 1. Supabase
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('soft_skill_vocab_words')
        .select('words')
        .eq('date', date)
        .maybeSingle();
      if (data?.words && Array.isArray(data.words) && (data.words as unknown[]).length === 10) {
        return data.words as unknown as VocabWord[];
      }
    } catch { /* fall through */ }
  }

  // 2. localStorage
  try {
    const raw = localStorage.getItem(VOCAB_LS_PREFIX + date);
    if (raw) {
      const cached = JSON.parse(raw) as VocabWord[];
      if (Array.isArray(cached) && cached.length === 10) return cached;
    }
  } catch { /* ignore */ }

  // 3. Generate
  const result = await groqJSON<{ words: VocabWord[] }>(
    'You are an English vocabulary teacher for Bengali speakers. Return valid JSON only.',
    `Generate exactly 10 intermediate-level English vocabulary words for ${date}.
Return JSON: {"words": [...]}
Each word object must have:
- "word": the English word (string)
- "partOfSpeech": noun/verb/adjective/adverb/phrase (string, lowercase)
- "banglaMeaning": the meaning written in Bengali script (e.g. "সুন্দর")
- "exampleSentence": a natural, clear example sentence using this word (string)
Choose practical everyday words. Vary the parts of speech.`,
    2048,
  );

  const words = (result.words ?? []).slice(0, 10);

  // 4. Persist
  try { localStorage.setItem(VOCAB_LS_PREFIX + date, JSON.stringify(words)); } catch { /* quota */ }
  if (isSupabaseConfigured) {
    try {
      await supabase.from('soft_skill_vocab_words').upsert({
        date,
        words: words as unknown as Record<string, unknown>[],
      });
    } catch { /* non-fatal */ }
  }

  return words;
}

export async function getVocabDateHistory(limit = 14): Promise<string[]> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('soft_skill_vocab_words')
        .select('date')
        .order('date', { ascending: false })
        .limit(limit);
      return (data ?? []).map((r) => r.date as string);
    } catch { /* fall through */ }
  }

  // Fallback: scan localStorage
  const dates: string[] = [];
  for (let i = 1; i <= limit; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (localStorage.getItem(VOCAB_LS_PREFIX + date)) dates.push(date);
  }
  return dates;
}

// ---- User Sentences (vocab practice) ----------------------------------------

function sentencesLocalKey(uid: string | null, date: string) {
  return `skillpath:vocab-sentences:${uid ?? 'guest'}:${date}`;
}

export async function getUserSentences(uid: string | null, date: string): Promise<Record<number, string>> {
  let localData: Record<number, string> = {};
  try {
    const raw = localStorage.getItem(sentencesLocalKey(uid, date));
    if (raw) localData = JSON.parse(raw) as Record<number, string>;
  } catch { /* ignore */ }

  if (!uid || !isSupabaseConfigured) return localData;

  try {
    const { data } = await supabase
      .from('soft_skill_vocab_sentences')
      .select('sentences')
      .eq('user_id', uid)
      .eq('date', date)
      .maybeSingle();
    if (data?.sentences) {
      return { ...localData, ...(data.sentences as Record<number, string>) };
    }
  } catch { /* ignore */ }

  return localData;
}

export async function saveUserSentence(
  uid: string | null,
  date: string,
  wordIndex: number,
  sentence: string,
): Promise<void> {
  const existing = await getUserSentences(uid, date);
  existing[wordIndex] = sentence;

  try { localStorage.setItem(sentencesLocalKey(uid, date), JSON.stringify(existing)); } catch { /* quota */ }

  if (uid && isSupabaseConfigured) {
    try {
      await supabase.from('soft_skill_vocab_sentences').upsert({
        user_id: uid,
        date,
        sentences: existing as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  }
}

// ---- Voice Chat (Groq streaming) --------------------------------------------

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function streamVoiceChat(
  history: GeminiMessage[],
  userMessage: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey) throw new Error('Groq not configured. Add VITE_GROQ_STUDYPACK_API_KEY to .env.local.');

  const messages = [
    {
      role: 'system',
      content:
        'You are Alex, a friendly English communication coach. Help the user practice speaking English. Keep every response to 2-3 sentences maximum — natural and conversational. Gently correct mistakes when needed. Never use markdown, bullet points, or formatting.',
    },
    // Convert Gemini-format history to OpenAI/Groq format
    ...history.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.parts.map((p) => p.text).join(''),
    })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({ model: GROQ_MODEL, messages, stream: true, temperature: 0.8, max_tokens: 200 }),
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
    if (signal?.aborted) { reader.cancel(); break; }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6)) as { choices?: { delta?: { content?: string } }[] };
        const text = json.choices?.[0]?.delta?.content ?? '';
        if (text) { full += text; onDelta(text); }
      } catch { /* malformed SSE chunk — skip */ }
    }
  }

  return full;
}
