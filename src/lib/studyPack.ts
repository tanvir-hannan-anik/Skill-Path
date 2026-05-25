import { GoogleGenAI } from '@google/genai';
import type { GeneratedTask, StudyPack, WeeklyAssignment, Schedule, QuizQuestion } from '../types';
import { generateQuiz as groqGenerateQuiz, generateTasks as groqGenerateTasks, generateWeeklyProject as groqGenerateWeeklyProject } from './groq';

export type { GeneratedTask };

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash-lite';

const client: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;

function studyPackId(url: string): string {
  // Stable, filesystem-safe id derived from the URL.
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return `doc_${Math.abs(hash).toString(36)}`;
}

const STUDY_PACK_SYSTEM = [
  'You are a senior curriculum designer who turns a single documentation page',
  'into a focused study pack: key concepts, an estimated reading time, a 5-question',
  'multiple-choice quiz, 2 short hands-on assignments, and 6 practice problems',
  '(2 easy, 2 medium, 2 hard) each with a hint and a complete solution.',
  '',
  'You will receive a URL and title. Use your knowledge of the topic to produce',
  'high-quality content. Never invent URLs. Never reference content you cannot',
  'reasonably infer from the title and well-known docs.',
  '',
  'Respond with ONLY valid JSON matching the schema. No prose.',
].join('\n');

const STUDY_PACK_JSON_SCHEMA = {
  type: 'object',
  properties: {
    conceptList: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
    readingMinutes: { type: 'number' },
    quiz: {
      type: 'array',
      minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          answer: { type: 'number' },
          explanation: { type: 'string' },
        },
        required: ['q', 'choices', 'answer', 'explanation'],
      },
    },
    assignments: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    problems: {
      type: 'object',
      properties: {
        easy: { type: 'array', items: problemSchema(), minItems: 2, maxItems: 2 },
        medium: { type: 'array', items: problemSchema(), minItems: 2, maxItems: 2 },
        hard: { type: 'array', items: problemSchema(), minItems: 2, maxItems: 2 },
      },
      required: ['easy', 'medium', 'hard'],
    },
  },
  required: ['conceptList', 'readingMinutes', 'quiz', 'assignments', 'problems'],
};

function problemSchema() {
  return {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      hint: { type: 'string' },
      solution: { type: 'string' },
    },
    required: ['prompt', 'solution'],
  };
}

export async function generateStudyPack(docUrl: string, docTitle: string): Promise<StudyPack> {
  if (!client) {
    throw new Error('AI is not configured. Add VITE_GEMINI_API_KEY to .env.local.');
  }
  const userPrompt = `Generate a study pack for:\n- URL: ${docUrl}\n- Title: ${docTitle}\n\nReturn JSON only.`;

  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: STUDY_PACK_SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: STUDY_PACK_JSON_SCHEMA as unknown as object,
    },
  });

  const raw = res.text;
  if (!raw) throw new Error('AI returned an empty response.');

  let parsed: Omit<StudyPack, 'id' | 'docUrl' | 'docTitle' | 'generatedAt'>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned malformed JSON. Try again.');
  }

  return {
    id: studyPackId(docUrl),
    docUrl,
    docTitle,
    generatedAt: Date.now(),
    ...parsed,
  };
}

// ---- Topic quiz (Groq primary, Gemini fallback) ----------------------------

export async function generateTopicQuiz(topic: string, count: number = 5): Promise<QuizQuestion[]> {
  try {
    return await groqGenerateQuiz(topic, count);
  } catch (groqErr) {
    if (!client) throw groqErr;
    const n = Math.max(1, Math.min(count, 10));
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: `Generate ${n} multiple-choice quiz questions about: "${topic}". Return JSON array with fields: q, choices (4 items), answer (0-indexed), explanation.` }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw = res.text;
    if (!raw) throw new Error('AI returned an empty response.');
    try { return (JSON.parse(raw) as QuizQuestion[]).slice(0, n); } catch { throw new Error('AI returned malformed JSON. Try again.'); }
  }
}

// ---- Daily task assignments (Groq primary, Gemini fallback) ----------------

export async function generateDailyAssignments(topic: string): Promise<GeneratedTask[]> {
  try {
    return await groqGenerateTasks(topic);
  } catch (groqErr) {
    if (!client) throw groqErr;
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: `Generate 3 practical tasks (Easy/Medium/Hard) for studying: "${topic}". Return JSON array with fields: title, description, difficulty.` }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw = res.text;
    if (!raw) throw new Error('AI returned an empty response.');
    try {
      return (JSON.parse(raw) as Omit<GeneratedTask, 'id'>[]).map((t, i) => ({ ...t, id: `gen_${Date.now()}_${i}`, difficulty: t.difficulty as GeneratedTask['difficulty'] }));
    } catch { throw new Error('AI returned malformed JSON. Try again.'); }
  }
}

// ---- Weekly assignment -----------------------------------------------------

export function isoWeekKey(d: Date = new Date()): string {
  // ISO week — copy of standard algorithm.
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns the YYYY-MM-DD keys for the current ISO week (Mon..Sun). */
export function isoWeekDates(d: Date = new Date()): string[] {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon = 0
  date.setDate(date.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(date);
    x.setDate(date.getDate() + i);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
}

export function extractWeekTopics(schedule: Schedule, dates: string[]): string[] {
  const topics: string[] = [];
  for (const key of dates) {
    const day = schedule[key];
    if (!day) continue;
    if (day.topicTitle?.trim()) topics.push(day.topicTitle.trim());
    for (const v of day.videos ?? []) topics.push(v.title);
    for (const d of day.docs ?? []) topics.push(d.title);
  }
  // De-dupe while preserving order.
  return Array.from(new Set(topics)).slice(0, 12);
}

export async function generateWeeklyAssignment(opts: {
  skill: string;
  topics: string[];
  weekKey: string;
}): Promise<WeeklyAssignment> {
  let text: string;
  try {
    text = await groqGenerateWeeklyProject(opts.skill, opts.topics);
  } catch (groqErr) {
    if (!client) throw groqErr;
    if (opts.topics.length === 0) throw new Error('No topics completed this week yet — add some learning content first.');
    const prompt = [
      `The learner is studying: "${opts.skill}". Topics this week:`,
      ...opts.topics.map((t) => `- ${t}`),
      'Design ONE 2–4 hour hands-on weekly project in Markdown: ## Overview, ## Requirements, ## Stretch Goals, ## How to Submit. Under 400 words.',
    ].join('\n');
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    text = res.text?.trim() ?? '';
    if (!text) throw new Error('AI returned an empty response.');
  }

  return { weekKey: opts.weekKey, prompt: text, topics: opts.topics, generatedAt: Date.now() };
}
