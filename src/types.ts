export type NavItem = 'dashboard' | 'learn' | 'plan' | 'tasks' | 'calendar' | 'insights' | 'profile';

export interface Workspace {
  id: string;
  name: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  hoursPerDay?: number;
  createdAt: number;
  color: string;
}

export const WORKSPACE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

export function genWorkspaceId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
export type ContentTypePill = 'video' | 'docs' | 'notes' | 'quiz' | 'assignment';

export interface Resource {
  url: string;
  title: string;
  source: string;
  portionStart?: string; // mm:ss or hh:mm:ss
  portionEnd?: string;
}

export interface QuizPlan {
  id: string;
  topic?: string;
  count: number;
}

export interface AssignmentPlan {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface NotePlan {
  id: string;
  title: string;
  driveUrl: string;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt?: number;
}

export interface DayContent {
  topicTitle?: string;
  videos: Resource[];
  docs: Resource[];
  tasks: Task[];
  quizzes?: QuizPlan[];
  assignments?: AssignmentPlan[];
  notes?: NotePlan[];
}

/** Keyed by `YYYY-MM-DD`. */
export type Schedule = Record<string, DayContent>;

export interface UserProfile {
  skill?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  hoursPerDay?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id?: string;
  role: 'ai' | 'user';
  text: string;
  createdAt?: number;
  /** Set while a model reply is streaming. */
  pending?: boolean;
}

// ---- Search ----------------------------------------------------------------

export interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt?: string;
  /** Optional duration in seconds (only present if details fetched). */
  durationSec?: number;
}

// ---- Video portion scheduling ---------------------------------------------

/**
 * A single watch session: "I'll watch from `startSec` to `endSec` on `date`."
 * `watchedSec` is the latest playback position recorded by the YouTube IFrame
 * Player API. When `watchedSec >= endSec`, the session is complete.
 */
export interface VideoSession {
  id: string;
  videoId: string;
  date: string; // YYYY-MM-DD
  startSec: number;
  endSec: number;
  watchedSec: number;
  completed: boolean;
}

export interface VideoPlan {
  videoId: string;
  url: string;
  title: string;
  source: string;
  totalSec: number;
  sessions: VideoSession[];
}

// ---- AI study packs --------------------------------------------------------

export interface QuizQuestion {
  q: string;
  choices: string[];
  /** 0-indexed correct answer. */
  answer: number;
  explanation: string;
}

export interface PracticeProblem {
  prompt: string;
  hint?: string;
  solution: string;
}

export interface StudyPack {
  /** Stable id derived from the document URL. */
  id: string;
  docUrl: string;
  docTitle: string;
  conceptList: string[];
  readingMinutes: number;
  quiz: QuizQuestion[];
  assignments: string[];
  problems: {
    easy: PracticeProblem[];
    medium: PracticeProblem[];
    hard: PracticeProblem[];
  };
  generatedAt: number;
}

export interface WeeklyAssignment {
  weekKey: string; // YYYY-WW (ISO week)
  prompt: string;
  topics: string[];
  generatedAt: number;
}

// ---- Saved-for-later -------------------------------------------------------

export interface SavedDoc extends Resource {
  id: string; // stable from url
  savedAt: number;
  read: boolean;
}
