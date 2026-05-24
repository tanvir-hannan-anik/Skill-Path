import { useCallback, useEffect, useRef, useState } from 'react';
import { saveVideoPlan, subscribeToVideoPlan } from '../lib/firestore';
import { getGuestVideoPlan, setGuestVideoPlan } from '../lib/localStore';
import type { VideoPlan } from '../types';

/**
 * Per-video watch plan (portion sessions + per-session progress).
 *
 * - Signed in: Firestore realtime sub, with 600 ms write debounce so the
 *   currentSec ticker doesn't hammer the DB every second of playback.
 * - Guest: localStorage with the same debounce on writes.
 */
export function useVideoPlan(uid: string | null, videoId: string | null) {
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!videoId) {
      setPlan(null);
      return;
    }
    if (!uid) {
      setPlan(getGuestVideoPlan(videoId));
      return;
    }
    return subscribeToVideoPlan(uid, videoId, (p) => setPlan(p));
  }, [uid, videoId]);

  const update = useCallback(
    (next: VideoPlan) => {
      setPlan(next);
      if (writeTimer.current) clearTimeout(writeTimer.current);

      writeTimer.current = setTimeout(() => {
        if (uid) {
          saveVideoPlan(uid, next).catch((err) => console.error('saveVideoPlan failed', err));
        } else {
          setGuestVideoPlan(next);
        }
      }, 600);
    },
    [uid]
  );

  useEffect(() => () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
  }, []);

  return { plan, update };
}
