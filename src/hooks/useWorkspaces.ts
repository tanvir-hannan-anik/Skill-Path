import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeToWorkspaces,
  saveWorkspace,
  deleteWorkspaceAndData,
  getActiveWorkspaceId,
  setActiveWorkspaceId as fsSetActiveWsId,
  migrateLegacySchedule,
  getProfile,
} from '../lib/firestore';
import {
  getGuestWorkspaces,
  addGuestWorkspace,
  removeGuestWorkspace,
  updateGuestWorkspace as updateLocalWorkspace,
  getGuestActiveWorkspaceId,
  setGuestActiveWorkspaceId,
  setGuestSkill,
} from '../lib/localStore';
import { WORKSPACE_COLORS, genWorkspaceId, type Workspace } from '../types';
import { useToast } from '../lib/toast';

function nextColor(workspaces: Workspace[]): string {
  return WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length];
}

export function useWorkspaces(uid: string | null) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWsIdState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const initializedRef = useRef(false);
  // Tracks whether we've already resolved the active workspace ID from Firestore
  // so we don't make an extra getActiveWorkspaceId round-trip on every snapshot.
  const activeIdResolvedRef = useRef(false);

  // ---- Load / subscribe -------------------------------------------------------

  useEffect(() => {
    initializedRef.current = false;
    activeIdResolvedRef.current = false;
    setLoading(true);

    if (!uid) {
      // Guest: read from localStorage, auto-migrate legacy if needed
      const wss = getGuestWorkspaces();
      const activeId = getGuestActiveWorkspaceId() || wss[0]?.id || '';
      setWorkspaces(wss);
      setActiveWsIdState(activeId);
      setLoading(false);
      initializedRef.current = true;
      return;
    }

    // Signed-in: subscribe to Firestore workspaces
    let cancelled = false;

    // Safety net: if Firestore never responds within 10 s, stop blocking the UI.
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn('[useWorkspaces] load timed out — showing UI with empty workspaces');
        setLoading(false);
      }
    }, 10_000);

    const unsub = subscribeToWorkspaces(
      uid,
      async (wss) => {
        if (cancelled) return;

        // Auto-create first workspace from legacy profile if none exist
        if (wss.length === 0 && !initializedRef.current) {
          initializedRef.current = true;
          try {
            const profile = await getProfile(uid);
            const name = profile?.skill?.trim() || 'My Workspace';
            const ws: Workspace = {
              id: genWorkspaceId(),
              name,
              level: profile?.level,
              hoursPerDay: profile?.hoursPerDay,
              createdAt: Date.now(),
              color: WORKSPACE_COLORS[0],
            };
            await saveWorkspace(uid, ws);
            await migrateLegacySchedule(uid, ws.id);
            await fsSetActiveWsId(uid, ws.id);
            if (!cancelled) {
              // Pre-resolve the active ID so the next snapshot doesn't need another Firestore read
              activeIdResolvedRef.current = true;
              setActiveWsIdState(ws.id);
            }
          } catch (err) {
            console.error('workspace migration failed', err);
          }
          // Firestore subscription will fire again with the new workspace
          return;
        }

        initializedRef.current = true;

        // Sort by createdAt
        const sorted = [...wss].sort((a, b) => a.createdAt - b.createdAt);
        setWorkspaces(sorted);

        if (!activeIdResolvedRef.current) {
          // First load: fetch the stored active workspace ID from the profile doc
          const storedActiveId = await getActiveWorkspaceId(uid);
          if (cancelled) return;
          activeIdResolvedRef.current = true;
          const validId =
            storedActiveId && sorted.some((w) => w.id === storedActiveId)
              ? storedActiveId
              : sorted[0]?.id ?? '';
          setActiveWsIdState(validId);
        } else {
          // Subsequent snapshots (e.g. after create/delete): keep current active ID
          // if it's still valid, otherwise fall back to first workspace.
          setActiveWsIdState((prev) => {
            if (sorted.some((w) => w.id === prev)) return prev;
            return sorted[0]?.id ?? '';
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('workspaces subscription error', err);
        toast.error('Could not load workspaces.');
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [uid, toast]);

  // ---- Actions ----------------------------------------------------------------

  const createWorkspace = useCallback(
    async (name: string, level?: Workspace['level'], hoursPerDay?: number): Promise<string> => {
      const ws: Workspace = {
        id: genWorkspaceId(),
        name: name.trim() || 'New Workspace',
        level,
        hoursPerDay,
        createdAt: Date.now(),
        color: nextColor(workspaces),
      };

      // Optimistically update local state immediately so the UI responds even
      // before Firestore confirms.
      setWorkspaces((prev) => [...prev, ws]);
      setActiveWsIdState(ws.id);

      if (!uid) {
        addGuestWorkspace(ws);
        setGuestActiveWorkspaceId(ws.id);
        setGuestSkill(ws.name);
      } else {
        try {
          await saveWorkspace(uid, ws);
          await fsSetActiveWsId(uid, ws.id);
        } catch (err) {
          console.error('createWorkspace Firestore write failed', err);
          toast.error('Could not save workspace to cloud. It is available locally this session.');
        }
      }
      return ws.id;
    },
    [uid, workspaces, toast],
  );

  const switchWorkspace = useCallback(
    async (wsId: string) => {
      setActiveWsIdState(wsId);
      if (!uid) {
        setGuestActiveWorkspaceId(wsId);
        const ws = workspaces.find((w) => w.id === wsId);
        if (ws) setGuestSkill(ws.name);
      } else {
        try {
          await fsSetActiveWsId(uid, wsId);
        } catch (err) {
          console.error('switchWorkspace failed', err);
        }
      }
    },
    [uid, workspaces],
  );

  const deleteWorkspace = useCallback(
    async (wsId: string) => {
      if (workspaces.length <= 1) {
        toast.error('You need at least one workspace.');
        return;
      }

      if (!uid) {
        removeGuestWorkspace(wsId);
        const remaining = workspaces.filter((w) => w.id !== wsId);
        setWorkspaces(remaining);
        if (activeWorkspaceId === wsId) {
          const newId = remaining[0]?.id ?? '';
          setActiveWsIdState(newId);
          setGuestActiveWorkspaceId(newId);
        }
      } else {
        // Optimistic update
        const remaining = workspaces.filter((w) => w.id !== wsId);
        setWorkspaces(remaining);
        if (activeWorkspaceId === wsId) {
          const newId = remaining[0]?.id ?? '';
          setActiveWsIdState(newId);
        }
        try {
          await deleteWorkspaceAndData(uid, wsId);
          if (activeWorkspaceId === wsId) {
            const newId = remaining[0]?.id ?? '';
            await fsSetActiveWsId(uid, newId);
          }
        } catch (err) {
          console.error('deleteWorkspace failed', err);
          toast.error('Could not delete workspace from cloud.');
        }
      }
    },
    [uid, workspaces, activeWorkspaceId, toast],
  );

  const updateWorkspace = useCallback(
    async (wsId: string, patch: Partial<Pick<Workspace, 'name' | 'level' | 'hoursPerDay' | 'color'>>) => {
      // Optimistic update for both guest and signed-in
      setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, ...patch } : w)));
      if (!uid) {
        updateLocalWorkspace(wsId, patch);
        if (patch.name) setGuestSkill(patch.name);
      } else {
        const ws = workspaces.find((w) => w.id === wsId);
        if (!ws) return;
        try {
          await saveWorkspace(uid, { ...ws, ...patch });
        } catch (err) {
          console.error('updateWorkspace failed', err);
          toast.error('Could not update workspace.');
        }
      }
    },
    [uid, workspaces, toast],
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    updateWorkspace,
  };
}
