import { GoogleGenAI } from '@google/genai';
import type { StudyPack, WeeklyAssignment, Schedule, QuizQuestion } from '../types';

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

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

// ---- Topic quiz ------------------------------------------------------------

export async function generateTopicQuiz(topic: string, count: number = 5): Promise<QuizQuestion[]> {
  if (!client) throw new Error('AI is not configured. Add VITE_GEMINI_API_KEY to .env.local.');
  const n = Math.max(1, Math.min(count, 10));
  const prompt = `Generate ${n} multiple-choice quiz questions testing understanding of: "${topic}".
Each question must have exactly 4 answer choices and one correct answer (0-indexed integer 0-3).
Include a brief explanation (1-2 sentences) for the correct answer.
Return JSON array only.`;

  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
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
      } as unknown as object,
    },
  });

  const raw = res.text;
  if (!raw) throw new Error('AI returned an empty response.');
  let parsed: QuizQuestion[];
  try { parsed = JSON.parse(raw); } catch { throw new Error('AI returned malformed JSON. Try again.'); }
  return parsed.slice(0, n);
}

// ---- Daily task assignments ------------------------------------------------

export async function generateDailyAssignments(topic: string): Promise<GeneratedTask[]> {
  if (!client) throw new Error('AI is not configured. Add VITE_GEMINI_API_KEY to .env.local.');
  const prompt = `Generate 3 practical hands-on tasks for a learner studying: "${topic}".
- Task 1: Easy (30 min) — a simple exercise to build confidence
- Task 2: Medium (1 hour) — apply the concept in a realistic scenario
- Task 3: Hard (2 hours) — a challenging project-style problem
Each task needs a concise title and a clear 2-3 sentence description of what to do.
Return JSON array only.`;

  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
          },
          required: ['title', 'description', 'difficulty'],
        },
      } as unknown as object,
    },
  });

  const raw = res.text;
  if (!raw) throw new Error('AI returned an empty response.');
  let parsed: Omit<GeneratedTask, 'id'>[];
  try { parsed = JSON.parse(raw); } catch { throw new Error('AI returned malformed JSON. Try again.'); }
  return parsed.map((t, i) => ({ ...t, id: `gen_${Date.now()}_${i}`, difficulty: t.difficulty as GeneratedTask['difficulty'] }));
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
  if (!client) {
    throw new Error('AI is not configured. Add VITE_GEMINI_API_KEY to .env.local.');
  }
  if (opts.topics.length === 0) {
    throw new Error('No topics completed this week yet — add some learning content first.');
  }

  const prompt = [
    `The learner is studying: "${opts.skill}".`,
    `Topics covered this week:`,
    ...opts.topics.map((t) => `- ${t}`),
    '',
    'Design ONE substantial weekly project that synthesises these topics. It should',
    'take 2–4 hours, be hands-on, produce a tangible artefact (small app, document,',
    'or design), and include clear acceptance criteria. Format as Markdown with',
    'sections: Overview, Requirements (bulleted), Stretch goals, How to submit.',
    'Keep it under 400 words. Do not invent URLs.',
  ].join('\n');

  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const text = res.text?.trim();
  if (!text) throw new Error('AI returned an empty response.');

  return {
    weekKey: opts.weekKey,
    prompt: text,
    topics: opts.topics,
    generatedAt: Date.now(),
  };
}
