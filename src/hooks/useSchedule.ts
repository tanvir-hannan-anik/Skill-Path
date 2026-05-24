import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWsScheduleDay, subscribeToWsSchedule } from '../lib/firestore';
import { getGuestWsSchedule, setGuestWsSchedule } from '../lib/localStore';
import type { DayContent, Schedule } from '../types';
import { useToast } from '../lib/toast';

/**
 * Realtime per-workspace schedule with optimistic local writes.
 *
 * - **Signed in**: subscribes to Firestore at `/users/{uid}/workspaces/{wsId}/data/schedule`.
 * - **Guest**: reads/writes localStorage at `skillpath:ws:{wsId}:schedule`.
 */
export function useSchedule(uid: string | null, workspaceId: string | null) {
  const [schedule, setSchedule] = useState<Schedule>({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const pendingWrites = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!workspaceId) {
      setSchedule({});
      setLoading(false);
      return;
    }

    if (!uid) {
      setSchedule(getGuestWsSchedule(workspaceId));
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToWsSchedule(
      uid,
      workspaceId,
      (s) => {
        setSchedule(s);
        setLoading(false);
      },
      (err) => {
        console.error('schedule subscription error', err);
        toast.error('Could not load your schedule. Check your connection.');
        setLoading(false);
      },
    );
    return () => {
      unsub();
      pendingWrites.current.forEach(clearTimeout);
      pendingWrites.current.clear();
    };
  }, [uid, workspaceId, toast]);

  const updateDay = useCallback(
    (date: string, day: DayContent) => {
      setSchedule((prev) => {
        const next = { ...prev, [date]: day };
        if (!uid && workspaceId) setGuestWsSchedule(workspaceId, next);
        return next;
      });

      if (!uid || !workspaceId) return;

      const existing = pendingWrites.current.get(date);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        try {
          await saveWsScheduleDay(uid, workspaceId, date, day);
        } catch (err) {
          console.error('saveWsScheduleDay failed', err);
          toast.error('Failed to save changes. They may be lost on refresh.');
        } finally {
          pendingWrites.current.delete(date);
        }
      }, 400);

      pendingWrites.current.set(date, timer);
    },
    [uid, workspaceId, toast],
  );

  return { schedule, loading, updateDay };
}
