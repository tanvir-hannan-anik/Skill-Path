import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
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

/** Document refs are namespaced under each user so security rules can enforce `request.auth.uid == userId`. */
const profileDoc = (uid: string) => doc(db, 'users', uid);

// ---- Workspaces -------------------------------------------------------------

const workspacesCol = (uid: string) => collection(db, 'users', uid, 'workspaces');
const workspaceDoc = (uid: string, wsId: string) => doc(db, 'users', uid, 'workspaces', wsId);
const wsScheduleDoc = (uid: string, wsId: string) =>
  doc(db, 'users', uid, 'workspaces', wsId, 'data', 'schedule');

export function subscribeToWorkspaces(
  uid: string,
  cb: (workspaces: Workspace[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    workspacesCol(uid),
    (snap) => cb(snap.docs.map((d) => d.data() as Workspace)),
    (err) => onError?.(err as Error),
  );
}

export async function getWorkspaces(uid: string): Promise<Workspace[]> {
  const snap = await getDocs(workspacesCol(uid));
  return snap.docs.map((d) => d.data() as Workspace);
}

export async function saveWorkspace(uid: string, ws: Workspace) {
  await setDoc(workspaceDoc(uid, ws.id), ws);
}

export async function deleteWorkspaceAndData(uid: string, wsId: string) {
  // Delete schedule sub-doc
  try { await deleteDoc(wsScheduleDoc(uid, wsId)); } catch { /* ok */ }
  // Delete workspace doc
  await deleteDoc(workspaceDoc(uid, wsId));
}

export async function getActiveWorkspaceId(uid: string): Promise<string | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data()?.activeWorkspaceId ?? null) : null;
}

export async function setActiveWorkspaceId(uid: string, wsId: string) {
  await setDoc(profileDoc(uid), { activeWorkspaceId: wsId, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Schedule (workspace-scoped) --------------------------------------------

export function subscribeToWsSchedule(
  uid: string,
  wsId: string,
  cb: (schedule: Schedule) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    wsScheduleDoc(uid, wsId),
    (snap) => {
      const data = snap.data();
      cb((data?.days as Schedule) ?? {});
    },
    (err) => onError?.(err as Error),
  );
}

export async function saveWsScheduleDay(uid: string, wsId: string, date: string, day: unknown) {
  await setDoc(
    wsScheduleDoc(uid, wsId),
    { days: { [date]: day }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getWsSchedule(uid: string, wsId: string): Promise<Schedule> {
  const snap = await getDoc(wsScheduleDoc(uid, wsId));
  return (snap.data()?.days as Schedule) ?? {};
}

/** Copy data from the legacy single-workspace path into a new workspace. */
export async function migrateLegacySchedule(uid: string, wsId: string) {
  const legacySnap = await getDoc(doc(db, 'users', uid, 'data', 'schedule'));
  if (!legacySnap.exists()) return;
  const days = legacySnap.data()?.days ?? {};
  if (Object.keys(days).length === 0) return;
  await setDoc(wsScheduleDoc(uid, wsId), { days, updatedAt: serverTimestamp() });
}

// ---- Profile ----------------------------------------------------------------

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function upsertProfile(uid: string, patch: Partial<UserProfile>) {
  await setDoc(
    profileDoc(uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ---- Legacy schedule (kept for migration only) ------------------------------

const legacyScheduleDoc = (uid: string) => doc(db, 'users', uid, 'data', 'schedule');

export async function mergeScheduleIntoAccount(uid: string, localSchedule: Schedule) {
  if (Object.keys(localSchedule).length === 0) return;
  const snap = await getDoc(legacyScheduleDoc(uid));
  const remote: Schedule = (snap.data()?.days as Schedule) ?? {};
  const merged: Record<string, DayContent> = { ...remote };
  for (const [date, day] of Object.entries(localSchedule)) {
    merged[date] = day;
  }
  await setDoc(legacyScheduleDoc(uid), { days: merged, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Chat -------------------------------------------------------------------

const chatCol = (uid: string) => collection(db, 'users', uid, 'chat');

export function subscribeToChat(
  uid: string,
  cb: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    query(chatCol(uid), orderBy('createdAt', 'asc')),
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data() as { role: 'ai' | 'user'; text: string; createdAt?: Timestamp };
          return {
            id: d.id,
            role: data.role,
            text: data.text,
            createdAt: data.createdAt?.toMillis() ?? Date.now(),
          };
        }),
      );
    },
    (err) => onError?.(err as Error),
  );
}

export async function appendChatMessage(uid: string, role: 'ai' | 'user', text: string) {
  await addDoc(chatCol(uid), { role, text, createdAt: serverTimestamp() });
}

export async function bulkAppendChat(uid: string, messages: ChatMessage[]) {
  if (messages.length === 0) return;
  const batch = writeBatch(db);
  for (const m of messages) {
    const ref = doc(chatCol(uid));
    batch.set(ref, {
      role: m.role,
      text: m.text,
      createdAt: m.createdAt ? Timestamp.fromMillis(m.createdAt) : serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function clearChat(uid: string) {
  const snap = await getDocs(chatCol(uid));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---- Study packs -----------------------------------------------------------

const studyPackDoc = (uid: string, id: string) => doc(db, 'users', uid, 'studyPacks', id);

export async function getStudyPack(uid: string, id: string): Promise<StudyPack | null> {
  const snap = await getDoc(studyPackDoc(uid, id));
  return snap.exists() ? (snap.data() as StudyPack) : null;
}

export async function saveStudyPack(uid: string, pack: StudyPack) {
  await setDoc(studyPackDoc(uid, pack.id), pack);
}

// ---- Saved-for-later docs --------------------------------------------------

const savedDocsCol = (uid: string) => collection(db, 'users', uid, 'savedDocs');

export function subscribeToSavedDocs(uid: string, cb: (docs: SavedDoc[]) => void) {
  return onSnapshot(query(savedDocsCol(uid), orderBy('savedAt', 'desc')), (snap) => {
    cb(snap.docs.map((d) => d.data() as SavedDoc));
  });
}

export async function saveDoc(uid: string, doc_: SavedDoc) {
  await setDoc(doc(savedDocsCol(uid), doc_.id), doc_);
}

export async function removeSavedDoc(uid: string, id: string) {
  await deleteDoc(doc(savedDocsCol(uid), id));
}

// ---- Video plans -----------------------------------------------------------

const videoPlanDoc = (uid: string, videoId: string) => doc(db, 'users', uid, 'videoPlans', videoId);

export async function getVideoPlan(uid: string, videoId: string): Promise<VideoPlan | null> {
  const snap = await getDoc(videoPlanDoc(uid, videoId));
  return snap.exists() ? (snap.data() as VideoPlan) : null;
}

export function subscribeToVideoPlan(
  uid: string,
  videoId: string,
  cb: (plan: VideoPlan | null) => void,
) {
  return onSnapshot(videoPlanDoc(uid, videoId), (snap) => {
    cb(snap.exists() ? (snap.data() as VideoPlan) : null);
  });
}

export async function saveVideoPlan(uid: string, plan: VideoPlan) {
  await setDoc(videoPlanDoc(uid, plan.videoId), plan);
}

// ---- Weekly assignments ----------------------------------------------------

const weeklyDoc = (uid: string, weekKey: string) =>
  doc(db, 'users', uid, 'weeklyAssignments', weekKey);

export async function getWeeklyAssignment(uid: string, weekKey: string): Promise<WeeklyAssignment | null> {
  const snap = await getDoc(weeklyDoc(uid, weekKey));
  return snap.exists() ? (snap.data() as WeeklyAssignment) : null;
}

export async function saveWeeklyAssignment(uid: string, a: WeeklyAssignment) {
  await setDoc(weeklyDoc(uid, a.weekKey), a);
}
