/**
 * Guest-mode persistence in localStorage.
 *
 * Supports multiple workspaces. Each workspace has its own schedule.
 * On sign-in, data is migrated into Firestore and localStorage is cleared.
 */

import type {
  ChatMessage,
  Schedule,
  StudyPack,
  SavedDoc,
  VideoPlan,
  WeeklyAssignment,
  Workspace,
} from '../types';
import { WORKSPACE_COLORS, genWorkspaceId } from '../types';

// ---- Keys ------------------------------------------------------------------

const K_WORKSPACES = 'skillpath:workspaces';
const K_ACTIVE_WS = 'skillpath:activeWorkspaceId';
const wsScheduleKey = (wsId: string) => `skillpath:ws:${wsId}:schedule`;

// Legacy keys (kept for migration)
const K_SKILL = 'skillpath:guest:skill';
const K_SCHEDULE = 'skillpath:guest:schedule';
const K_CHAT = 'skillpath:guest:chat';
const K_STUDY_PACKS = 'skillpath:guest:studyPacks';
const K_SAVED_DOCS = 'skillpath:guest:savedDocs';
const K_VIDEO_PLANS = 'skillpath:guest:videoPlans';
const K_WEEKLY = 'skillpath:guest:weekly';

// ---- Helpers ---------------------------------------------------------------

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[localStore] write failed', err);
  }
}

// ---- Workspaces ------------------------------------------------------------

export function getGuestWorkspaces(): Workspace[] {
  const stored = readJSON<Workspace[]>(K_WORKSPACES, []);
  if (stored.length > 0) return stored;

  // Migrate from legacy single-skill storage
  const legacySkill = localStorage.getItem(K_SKILL);
  if (legacySkill) {
    const ws: Workspace = {
      id: genWorkspaceId(),
      name: legacySkill,
      createdAt: Date.now(),
      color: WORKSPACE_COLORS[0],
    };
    const legacySchedule = readJSON<Schedule>(K_SCHEDULE, {});
    writeJSON(K_WORKSPACES, [ws]);
    localStorage.setItem(K_ACTIVE_WS, ws.id);
    writeJSON(wsScheduleKey(ws.id), legacySchedule);
    return [ws];
  }

  return [];
}

export function setGuestWorkspaces(workspaces: Workspace[]) {
  writeJSON(K_WORKSPACES, workspaces);
}

export function getGuestActiveWorkspaceId(): string {
  return localStorage.getItem(K_ACTIVE_WS) ?? '';
}

export function setGuestActiveWorkspaceId(wsId: string) {
  localStorage.setItem(K_ACTIVE_WS, wsId);
}

export function addGuestWorkspace(ws: Workspace) {
  const all = getGuestWorkspaces();
  all.push(ws);
  setGuestWorkspaces(all);
  writeJSON(wsScheduleKey(ws.id), {});
}

export function removeGuestWorkspace(wsId: string) {
  const all = getGuestWorkspaces().filter((w) => w.id !== wsId);
  setGuestWorkspaces(all);
  localStorage.removeItem(wsScheduleKey(wsId));
}

export function updateGuestWorkspace(wsId: string, patch: Partial<Workspace>) {
  const all = getGuestWorkspaces().map((w) => (w.id === wsId ? { ...w, ...patch } : w));
  setGuestWorkspaces(all);
}

// ---- Workspace schedule ----------------------------------------------------

export function getGuestWsSchedule(wsId: string): Schedule {
  return readJSON<Schedule>(wsScheduleKey(wsId), {});
}

export function setGuestWsSchedule(wsId: string, schedule: Schedule) {
  writeJSON(wsScheduleKey(wsId), schedule);
}

// ---- Legacy skill (kept so App.tsx onboarding check still works) -----------

export function getGuestSkill(): string {
  // Prefer active workspace name as the "skill"
  const wsId = getGuestActiveWorkspaceId();
  if (wsId) {
    const ws = getGuestWorkspaces().find((w) => w.id === wsId);
    if (ws) return ws.name;
  }
  return localStorage.getItem(K_SKILL) ?? '';
}

export function setGuestSkill(skill: string) {
  if (skill) localStorage.setItem(K_SKILL, skill);
}

// ---- Chat ------------------------------------------------------------------

export function getGuestChat(): ChatMessage[] {
  return readJSON<ChatMessage[]>(K_CHAT, []);
}

export function appendGuestChat(role: 'ai' | 'user', text: string): ChatMessage {
  const msg: ChatMessage = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
    createdAt: Date.now(),
  };
  const next = [...getGuestChat(), msg];
  writeJSON(K_CHAT, next);
  return msg;
}

export function clearGuestChat() {
  localStorage.removeItem(K_CHAT);
}

// ---- Study packs -----------------------------------------------------------

export function getGuestStudyPack(id: string): StudyPack | null {
  const all = readJSON<Record<string, StudyPack>>(K_STUDY_PACKS, {});
  return all[id] ?? null;
}

export function setGuestStudyPack(pack: StudyPack) {
  const all = readJSON<Record<string, StudyPack>>(K_STUDY_PACKS, {});
  all[pack.id] = pack;
  writeJSON(K_STUDY_PACKS, all);
}

// ---- Saved-for-later docs --------------------------------------------------

export function getGuestSavedDocs(): SavedDoc[] {
  return readJSON<SavedDoc[]>(K_SAVED_DOCS, []).sort((a, b) => b.savedAt - a.savedAt);
}

export function setGuestSavedDocs(docs: SavedDoc[]) {
  writeJSON(K_SAVED_DOCS, docs);
}

// ---- Video plans -----------------------------------------------------------

export function getGuestVideoPlan(videoId: string): VideoPlan | null {
  const all = readJSON<Record<string, VideoPlan>>(K_VIDEO_PLANS, {});
  return all[videoId] ?? null;
}

export function setGuestVideoPlan(plan: VideoPlan) {
  const all = readJSON<Record<string, VideoPlan>>(K_VIDEO_PLANS, {});
  all[plan.videoId] = plan;
  writeJSON(K_VIDEO_PLANS, all);
}

// ---- Weekly assignments ----------------------------------------------------

export function getGuestWeeklyAssignment(weekKey: string): WeeklyAssignment | null {
  const all = readJSON<Record<string, WeeklyAssignment>>(K_WEEKLY, {});
  return all[weekKey] ?? null;
}

export function setGuestWeeklyAssignment(a: WeeklyAssignment) {
  const all = readJSON<Record<string, WeeklyAssignment>>(K_WEEKLY, {});
  all[a.weekKey] = a;
  writeJSON(K_WEEKLY, all);
}

// ---- Legacy schedule (for migration on sign-in) ----------------------------

export function getGuestSchedule(): Schedule {
  // Return the active workspace's schedule for migration
  const wsId = getGuestActiveWorkspaceId();
  if (wsId) return getGuestWsSchedule(wsId);
  return readJSON<Schedule>(K_SCHEDULE, {});
}

export function setGuestSchedule(schedule: Schedule) {
  writeJSON(K_SCHEDULE, schedule);
}

// ---- Chat daily usage limit ------------------------------------------------

const chatDailyKey = (userKey: string, date: string) =>
  `skillpath:chat:daily:${date}:${userKey}`;

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getChatDailyUsage(userKey: string): number {
  return readJSON<number>(chatDailyKey(userKey, todayDateStr()), 0);
}

export function incrementChatDailyUsage(userKey: string): number {
  const key = chatDailyKey(userKey, todayDateStr());
  const next = readJSON<number>(key, 0) + 1;
  writeJSON(key, next);
  return next;
}

// ---- Clear all -------------------------------------------------------------

export function clearGuestData() {
  const workspaces = getGuestWorkspaces();
  workspaces.forEach((ws) => localStorage.removeItem(wsScheduleKey(ws.id)));
  [K_WORKSPACES, K_ACTIVE_WS, K_SCHEDULE, K_CHAT, K_SKILL, K_STUDY_PACKS, K_SAVED_DOCS, K_VIDEO_PLANS, K_WEEKLY].forEach(
    (k) => localStorage.removeItem(k),
  );
}

export function hasGuestData(): boolean {
  return [K_WORKSPACES, K_SCHEDULE, K_CHAT, K_SKILL, K_STUDY_PACKS, K_SAVED_DOCS].some(
    (k) => !!localStorage.getItem(k),
  );
}
