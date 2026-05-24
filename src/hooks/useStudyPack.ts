import { useCallback, useEffect, useState } from 'react';
import { getStudyPack, saveStudyPack } from '../lib/firestore';
import { getGuestStudyPack, setGuestStudyPack } from '../lib/localStore';
import { generateStudyPack } from '../lib/studyPack';
import type { StudyPack } from '../types';

function packIdFor(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  return `doc_${Math.abs(hash).toString(36)}`;
}

/**
 * Loads (and on-demand generates) the AI study pack for a single document.
 * Result is cached in Firestore (signed in) or localStorage (guest) so we
 * don't burn Gemini quota on every visit.
 */
export function useStudyPack(uid: string | null, doc: { url: string; title: string } | null) {
  const [pack, setPack] = useState<StudyPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached pack whenever the target doc changes.
  useEffect(() => {
    setError(null);
    if (!doc) {
      setPack(null);
      return;
    }
    const id = packIdFor(doc.url);
    let cancelled = false;
    (async () => {
      const cached = uid ? await getStudyPack(uid, id) : getGuestStudyPack(id);
      if (!cancelled) setPack(cached);
    })().catch((err) => {
      console.error(err);
      if (!cancelled) setError('Failed to load study pack.');
    });
    return () => { cancelled = true; };
  }, [uid, doc?.url, doc?.title]);

  const generate = useCallback(async () => {
    if (!doc) return;
    setLoading(true);
    setError(null);
    try {
      const fresh = await generateStudyPack(doc.url, doc.title);
      if (uid) await saveStudyPack(uid, fresh);
      else setGuestStudyPack(fresh);
      setPack(fresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [uid, doc?.url, doc?.title]);

  return { pack, loading, error, generate };
}
