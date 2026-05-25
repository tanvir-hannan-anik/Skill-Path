import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal slice of the YT IFrame Player API surface we use.
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

let apiPromise: Promise<void> | null = null;

function loadAPI(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
  return apiPromise;
}

/**
 * Mount the YouTube IFrame Player onto the returned ref. The hook polls
 * `getCurrentTime` once per second while playback is active so consumers can
 * persist progress to the watch plan.
 */
export function useYouTubePlayer(videoId: string | null) {
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [ready, setReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    setReady(false);

    (async () => {
      await loadAPI();
      if (cancelled || !containerRef.current || !window.YT) return;

      // Replace any prior player.
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      // YT.Player replaces the target element with its own iframe, so we feed
      // it a freshly-created child div to avoid losing our ref.
      const host = document.createElement('div');
      host.style.width = '100%';
      host.style.height = '100%';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(host);

      playerRef.current = new window.YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            setCurrentSec(0);
            setDurationSec(playerRef.current?.getDuration() ?? 0);
          },
          onStateChange: (event: { data: number }) => {
            if (!playerRef.current) return;
            setDurationSec(playerRef.current.getDuration() ?? 0);
            const isPlaying = event.data === 1; // 1 = YT.PlayerState.PLAYING
            // Poll while playing.
            if (isPlaying && !pollRef.current) {
              pollRef.current = setInterval(() => {
                const t = playerRef.current?.getCurrentTime() ?? 0;
                setCurrentSec(Math.floor(t));
              }, 1000);
            } else if (!isPlaying && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setCurrentSec(Math.floor(playerRef.current?.getCurrentTime() ?? 0));
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  const seekTo = useCallback((sec: number) => {
    playerRef.current?.seekTo(sec, true);
  }, []);

  return { containerRef: setContainer, currentSec, durationSec, ready, seekTo };
}
