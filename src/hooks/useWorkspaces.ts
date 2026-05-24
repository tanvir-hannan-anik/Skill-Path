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
  saveWorkspace as sbSaveWorkspace,
  deleteWorkspace as sbDeleteWorkspace,
  getWorkspaces as sbGetWorkspaces,
  getActiveWorkspaceId as sbGetActiveWsId,
  setActiveWorkspaceId as sbSetActiveWsId,
} from '../lib/supabaseDb';
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

        // Firestore returned empty — check Supabase before auto-creating
        if (wss.length === 0 && !initializedRef.current) {
          initializedRef.current = true;

          // Check Supabase first — workspace may have been saved there
          try {
            const sbWss = await sbGetWorkspaces(uid);
            if (sbWss.length > 0 && !cancelled) {
              const sorted = [...sbWss].sort((a, b) => a.createdAt - b.createdAt);
              const activeId = await sbGetActiveWsId(uid);
              setWorkspaces(sorted);
              const validId =
                activeId && sorted.some((w) => w.id === activeId)
                  ? activeId
                  : sorted[0]?.id ?? '';
              setActiveWsIdState(validId);
              activeIdResolvedRef.current = true;
              setLoading(false);
              return;
            }
          } catch (sbErr) {
            console.error('Supabase workspace check failed', sbErr);
          }

          // Nothing in Supabase either — auto-create from profile
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
            try {
              await saveWorkspace(uid, ws);
              await migrateLegacySchedule(uid, ws.id);
              await fsSetActiveWsId(uid, ws.id);
            } catch {
              await sbSaveWorkspace(uid, ws);
              await sbSetActiveWsId(uid, ws.id);
            }
            if (!cancelled) {
              activeIdResolvedRef.current = true;
              setActiveWsIdState(ws.id);
            }
          } catch (err) {
            console.error('workspace auto-create failed', err);
          }
          return;
        }

        initializedRef.current = true;

        // Sort by createdAt
        const sorted = [...wss].sort((a, b) => a.createdAt - b.createdAt);
        setWorkspaces(sorted);

        if (!activeIdResolvedRef.current) {
          let storedActiveId: string | null = null;
          try {
            storedActiveId = await getActiveWorkspaceId(uid);
          } catch {
            storedActiveId = await sbGetActiveWsId(uid);
          }
          if (cancelled) return;
          activeIdResolvedRef.current = true;
          const validId =
            storedActiveId && sorted.some((w) => w.id === storedActiveId)
              ? storedActiveId
              : sorted[0]?.id ?? '';
          setActiveWsIdState(validId);
        } else {
          setActiveWsIdState((prev) => {
            if (sorted.some((w) => w.id === prev)) return prev;
            return sorted[0]?.id ?? '';
          });
        }
        setLoading(false);
      },
      async (err) => {
        console.error('workspaces subscription error — falling back to Supabase', err);
        // Firestore failed: load workspaces from Supabase instead
        try {
          const wss = await sbGetWorkspaces(uid);
          const sorted = [...wss].sort((a, b) => a.createdAt - b.createdAt);
          const activeId = await sbGetActiveWsId(uid);
          if (!cancelled) {
            setWorkspaces(sorted);
            const validId =
              activeId && sorted.some((w) => w.id === activeId)
                ? activeId
                : sorted[0]?.id ?? '';
            setActiveWsIdState(validId);
            activeIdResolvedRef.current = true;
            initializedRef.current = true;
          }
        } catch (sbErr) {
          console.error('Supabase fallback also failed', sbErr);
          toast.error('Could not load workspaces.');
        }
        if (!cancelled) setLoading(false);
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
          console.error('createWorkspace Firestore write failed — trying Supabase', err);
          try {
            await sbSaveWorkspace(uid, ws);
            await sbSetActiveWsId(uid, ws.id);
          } catch (sbErr) {
            console.error('createWorkspace Supabase fallback failed', sbErr);
            toast.error('Could not save workspace to cloud. It is available locally this session.');
          }
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
        } catch {
          try {
            await sbSetActiveWsId(uid, wsId);
          } catch (sbErr) {
            console.error('switchWorkspace failed', sbErr);
          }
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
        } catch {
          try {
            await sbDeleteWorkspace(uid, wsId);
            if (activeWorkspaceId === wsId) {
              const newId = remaining[0]?.id ?? '';
              await sbSetActiveWsId(uid, newId);
            }
          } catch (sbErr) {
            console.error('deleteWorkspace failed', sbErr);
            toast.error('Could not delete workspace from cloud.');
          }
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
        } catch {
          try {
            await sbSaveWorkspace(uid, { ...ws, ...patch });
          } catch (sbErr) {
            console.error('updateWorkspace failed', sbErr);
            toast.error('Could not update workspace.');
          }
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
