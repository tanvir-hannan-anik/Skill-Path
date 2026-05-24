import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Play, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDuration } from '../lib/youtube';
import { toDateKey, parseDateKey } from '../lib/dates';
import type { VideoPlan, VideoSession } from '../types';

interface Props {
  plan: VideoPlan | null;
  onChange: (plan: VideoPlan) => void;
  onSeek?: (sec: number) => void;
  currentSec?: number;
  totalSecHint?: number;
  videoId: string;
  url: string;
  title: string;
  source: string;
  /** Called for each day a session is created so the video is added to that day's schedule. */
  onScheduleVideoForDate?: (date: string, video: import('../types').Resource) => void;
}

function newSessionId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** "01:23:45" / "23:45" -> seconds. Returns null on parse failure. */
function parseTimestamp(input: string): number | null {
  const parts = input.trim().split(':').map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3) return null;
  for (const p of parts) if (!/^\d+$/.test(p)) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/**
 * Splits a video into per-day watch sessions ("watch 0:00–30:00 today,
 * 30:00–1:00:00 tomorrow"). Tracks playback progress via the player's
 * `currentSec` and marks sessions complete when the user reaches `endSec`.
 */
export function VideoPortionScheduler({
  plan, onChange, onSeek, currentSec, totalSecHint, videoId, url, title, source, onScheduleVideoForDate,
}: Props) {
  const [newDate, setNewDate] = useState(() => toDateKey());
  const [newStart, setNewStart] = useState('0:00');
  const [newEnd, setNewEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalSec = plan?.totalSec ?? totalSecHint ?? 0;

  // Auto-update current session's watchedSec whenever currentSec advances.
  useEffect(() => {
    if (!plan || currentSec == null) return;
    const todayKey = toDateKey();
    const session = plan.sessions.find(
      (s) => s.date === todayKey && currentSec >= s.startSec && currentSec <= s.endSec + 5 && !s.completed
    );
    if (!session) return;

    const next = Math.max(session.watchedSec, currentSec);
    const becameComplete = next >= session.endSec - 1;
    if (next === session.watchedSec && session.completed === becameComplete) return;

    onChange({
      ...plan,
      sessions: plan.sessions.map((s) =>
        s.id === session.id ? { ...s, watchedSec: next, completed: becameComplete || s.completed } : s
      ),
    });
  }, [currentSec, plan, onChange]);

  function ensurePlan(): VideoPlan {
    return plan ?? {
      videoId,
      url,
      title,
      source,
      totalSec: totalSecHint ?? 0,
      sessions: [],
    };
  }

  function handleAddSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startSec = parseTimestamp(newStart);
    const endSec = parseTimestamp(newEnd);
    if (startSec == null || endSec == null) {
      setError('Use mm:ss or hh:mm:ss format.');
      return;
    }
    if (endSec <= startSec) {
      setError('End time must be after the start time.');
      return;
    }
    if (totalSec > 0 && endSec > totalSec) {
      setError(`End time exceeds video length (${formatDuration(totalSec)}).`);
      return;
    }

    const base = ensurePlan();
    const session: VideoSession = {
      id: newSessionId(),
      videoId,
      date: newDate,
      startSec,
      endSec,
      watchedSec: startSec,
      completed: false,
    };
    onChange({
      ...base,
      totalSec: Math.max(base.totalSec, totalSec, endSec),
      sessions: [...base.sessions, session].sort((a, b) =>
        a.date === b.date ? a.startSec - b.startSec : a.date.localeCompare(b.date)
      ),
    });
    setNewEnd('');
    // Suggest the next session start = the end we just used.
    setNewStart(newEnd);
  }

  function handleRemove(id: string) {
    const base = ensurePlan();
    onChange({ ...base, sessions: base.sessions.filter((s) => s.id !== id) });
  }

  function handleQuickSplit(parts: number) {
    if (totalSec <= 0) {
      setError('Total duration is unknown; add sessions manually.');
      return;
    }
    const chunk = Math.floor(totalSec / parts);
    const today = new Date();
    const sessions: VideoSession[] = Array.from({ length: parts }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const start = chunk * i;
      const end = i === parts - 1 ? totalSec : chunk * (i + 1);
      return {
        id: newSessionId(),
        videoId,
        date: toDateKey(date),
        startSec: start,
        endSec: end,
        watchedSec: start,
        completed: false,
      };
    });
    const base = ensurePlan();
    onChange({ ...base, totalSec, sessions });

    // Add the video resource to each day's schedule automatically
    if (onScheduleVideoForDate) {
      const video = { url, title, source };
      sessions.forEach((s) => onScheduleVideoForDate(s.date, video));
    }
  }

  const sessions = plan?.sessions ?? [];
  const totalWatched = sessions.reduce((sum, s) => sum + Math.max(0, s.watchedSec - s.startSec), 0);
  const totalPlanned = sessions.reduce((sum, s) => sum + (s.endSec - s.startSec), 0);
  const overallPct = totalPlanned > 0 ? Math.round((totalWatched / totalPlanned) * 100) : 0;

  return (
    <div className="bg-canvas border border-border-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-4 h-4 text-accent" />
        <h4 className="font-display font-medium text-lg text-primary">Watch plan</h4>
      </div>
      <p className="text-xs text-text-secondary mb-5">
        Split this {totalSec ? formatDuration(totalSec) : 'video'} across days. Progress is tracked as you watch.
      </p>

      {/* Overall progress */}
      {sessions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
            <span className="font-medium">{formatDuration(totalWatched)} of {formatDuration(totalPlanned)}</span>
            <span className="font-bold">{overallPct}%</span>
          </div>
          <div className="h-2 bg-white border border-border-strong rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
          </div>
        </div>
      )}

      {/* Quick split */}
      {totalSec > 0 && sessions.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-white border border-border-strong rounded-xl">
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted mr-2">Quick split</span>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleQuickSplit(n)}
              className="px-3 py-1.5 text-xs font-medium bg-canvas border border-border-strong text-text-secondary hover:text-primary hover:border-primary/30 rounded-lg transition-colors"
            >
              Across {n} days
            </button>
          ))}
        </div>
      )}

      {/* Session list */}
      <ul className="space-y-2 mb-5">
        <AnimatePresence initial={false}>
          {sessions.map((s) => {
            const range = s.endSec - s.startSec;
            const watched = Math.max(0, s.watchedSec - s.startSec);
            const pct = range > 0 ? Math.round((watched / range) * 100) : 0;
            const friendly = parseDateKey(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            return (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${s.completed ? 'border-emerald-200 bg-emerald-50/40' : 'border-border-strong'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  s.completed ? 'bg-emerald-500 text-white' : 'bg-canvas text-text-secondary'
                }`}>
                  {s.completed ? <Check className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-primary truncate">{friendly}</div>
                    <div className="text-xs text-text-muted tabular-nums shrink-0">
                      {formatDuration(s.startSec)} – {formatDuration(s.endSec)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-canvas border border-border-strong rounded-full overflow-hidden">
                      <div className={`h-full ${s.completed ? 'bg-emerald-500' : 'bg-primary'} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-text-muted tabular-nums shrink-0">{pct}%</span>
                  </div>
                </div>
                {onSeek && (
                  <button
                    type="button"
                    onClick={() => onSeek(s.watchedSec)}
                    aria-label="Resume this session"
                    title="Resume"
                    className="w-8 h-8 rounded-lg bg-canvas border border-border-strong hover:bg-primary hover:text-white text-text-secondary transition-colors flex items-center justify-center shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  aria-label="Remove session"
                  className="w-8 h-8 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* Add session form */}
      <form onSubmit={handleAddSession} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <label className="col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1 block mb-1">Date</span>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-white border border-border-strong rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-primary"
          />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1 block mb-1">Start</span>
          <input
            type="text"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            placeholder="0:00"
            className="w-full bg-white border border-border-strong rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-primary tabular-nums"
          />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1 block mb-1">End</span>
          <input
            type="text"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            placeholder={totalSec ? formatDuration(totalSec) : '30:00'}
            className="w-full bg-white border border-border-strong rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-primary tabular-nums"
          />
        </label>
        <button
          type="submit"
          className="bg-primary text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
