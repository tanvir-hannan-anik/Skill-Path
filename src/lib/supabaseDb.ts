/**
 * Supabase database layer — mirrors firestore.ts but uses Supabase Postgres.
 * Firebase Auth is still used for authentication; the Firebase UID is reused
 * as the Supabase row identifier so both stores stay in sync.
 */

import { supabase } from './supabase';
import type {
  DayContent,
  Schedule,
  UserProfile,
  ChatMessage,
  StudyPack,
  SavedDoc,
  VideoPlan,
  WeeklyAssignment,
  Workspace,
} from '../types';

// ---- Profiles ---------------------------------------------------------------

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  return data ? { activeWorkspaceId: data.active_workspace_id } as unknown as UserProfile : null;
}

export async function upsertProfile(uid: string, patch: Partial<UserProfile & { activeWorkspaceId?: string }>) {
  await supabase.from('profiles').upsert({
    id: uid,
    active_workspace_id: patch.activeWorkspaceId ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function getActiveWorkspaceId(uid: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('active_workspace_id')
    .eq('id', uid)
    .maybeSingle();
  return data?.active_workspace_id ?? null;
}

export async function setActiveWorkspaceId(uid: string, wsId: string) {
  await supabase.from('profiles').upsert({
    id: uid,
    active_workspace_id: wsId,
    updated_at: new Date().toISOString(),
  });
}

// ---- Workspaces -------------------------------------------------------------

export async function getWorkspaces(uid: string): Promise<Workspace[]> {
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', uid);
  return (data ?? []).map(rowToWorkspace);
}

export async function saveWorkspace(uid: string, ws: Workspace) {
  await supabase.from('workspaces').upsert({
    id: ws.id,
    user_id: uid,
    name: ws.name,
    color: ws.color,
    level: ws.level ?? null,
    hours_per_day: ws.hoursPerDay ?? null,
    created_at: ws.createdAt,
  });
}

export async function deleteWorkspace(uid: string, wsId: string) {
  await supabase.from('workspace_schedules').delete().eq('user_id', uid).eq('workspace_id', wsId);
  await supabase.from('workspaces').delete().eq('user_id', uid).eq('id', wsId);
}

function rowToWorkspace(row: {
  id: string; name: string; color: string;
  level: string | null; hours_per_day: number | null; created_at: number;
}): Workspace {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    level: row.level as Workspace['level'],
    hoursPerDay: row.hours_per_day ?? undefined,
    createdAt: row.created_at,
  };
}

// ---- Workspace schedules ----------------------------------------------------

export async function getWsSchedule(uid: string, wsId: string): Promise<Schedule> {
  const { data } = await supabase
    .from('workspace_schedules')
    .select('days')
    .eq('user_id', uid)
    .eq('workspace_id', wsId)
    .maybeSingle();
  return (data?.days as Schedule) ?? {};
}

export async function saveWsScheduleDay(uid: string, wsId: string, date: string, day: DayContent) {
  const existing = await getWsSchedule(uid, wsId);
  const updated = { ...existing, [date]: day };
  await supabase.from('workspace_schedules').upsert({
    user_id: uid,
    workspace_id: wsId,
    days: updated as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  });
}

export async function mergeScheduleIntoAccount(uid: string, localSchedule: Schedule) {
  if (Object.keys(localSchedule).length === 0) return;
  const { data } = await supabase
    .from('workspace_schedules')
    .select('days, workspace_id')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();
  const remote: Schedule = (data?.days as Schedule) ?? {};
  const merged = { ...remote, ...localSchedule };
  const wsId = data?.workspace_id ?? 'default';
  await supabase.from('workspace_schedules').upsert({
    user_id: uid,
    workspace_id: wsId,
    days: merged as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  });
}

// ---- Chat -------------------------------------------------------------------

export async function getChatMessages(uid: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as 'ai' | 'user',
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function appendChatMessage(uid: string, role: 'ai' | 'user', text: string) {
  await supabase.from('chat_messages').insert({
    user_id: uid,
    role,
    text,
    created_at: new Date().toISOString(),
  });
}

export async function bulkAppendChat(uid: string, messages: ChatMessage[]) {
  if (messages.length === 0) return;
  await supabase.from('chat_messages').insert(
    messages.map((m) => ({
      user_id: uid,
      role: m.role,
      text: m.text,
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    }))
  );
}

export async function clearChat(uid: string) {
  await supabase.from('chat_messages').delete().eq('user_id', uid);
}

// ---- Study packs ------------------------------------------------------------

export async function getStudyPack(uid: string, id: string): Promise<StudyPack | null> {
  const { data } = await supabase
    .from('study_packs')
    .select('data')
    .eq('user_id', uid)
    .eq('id', id)
    .maybeSingle();
  return data ? (data.data as unknown as StudyPack) : null;
}

export async function saveStudyPack(uid: string, pack: StudyPack) {
  await supabase.from('study_packs').upsert({
    id: pack.id,
    user_id: uid,
    data: pack as unknown as Record<string, unknown>,
  });
}

// ---- Saved docs -------------------------------------------------------------

export async function getSavedDocs(uid: string): Promise<SavedDoc[]> {
  const { data } = await supabase
    .from('saved_docs')
    .select('data, saved_at')
    .eq('user_id', uid)
    .order('saved_at', { ascending: false });
  return (data ?? []).map((row) => row.data as unknown as SavedDoc);
}

export async function saveDoc(uid: string, doc: SavedDoc) {
  await supabase.from('saved_docs').upsert({
    id: doc.id,
    user_id: uid,
    data: doc as unknown as Record<string, unknown>,
    saved_at: doc.savedAt,
  });
}

export async function removeSavedDoc(uid: string, id: string) {
  await supabase.from('saved_docs').delete().eq('user_id', uid).eq('id', id);
}

// ---- Video plans ------------------------------------------------------------

export async function getVideoPlan(uid: string, videoId: string): Promise<VideoPlan | null> {
  const { data } = await supabase
    .from('video_plans')
    .select('data')
    .eq('user_id', uid)
    .eq('video_id', videoId)
    .maybeSingle();
  return data ? (data.data as unknown as VideoPlan) : null;
}

export async function saveVideoPlan(uid: string, plan: VideoPlan) {
  await supabase.from('video_plans').upsert({
    video_id: plan.videoId,
    user_id: uid,
    data: plan as unknown as Record<string, unknown>,
  });
}

// ---- Weekly assignments -----------------------------------------------------

export async function getWeeklyAssignment(uid: string, weekKey: string): Promise<WeeklyAssignment | null> {
  const { data } = await supabase
    .from('weekly_assignments')
    .select('data')
    .eq('user_id', uid)
    .eq('week_key', weekKey)
    .maybeSingle();
  return data ? (data.data as unknown as WeeklyAssignment) : null;
}

export async function saveWeeklyAssignment(uid: string, a: WeeklyAssignment) {
  await supabase.from('weekly_assignments').upsert({
    week_key: a.weekKey,
    user_id: uid,
    data: a as unknown as Record<string, unknown>,
  });
}
