import { useState, useRef, useEffect } from 'react';
import {
  Pencil, Check as CheckIcon, X, LogOut, LogIn, Flame, Lock,
  Camera, User, Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { useStreak, getBadgeTier, BADGES } from '../hooks/useStreak';
import type { Schedule } from '../types';

const DotLottie = 'dotlottie-wc' as unknown as React.ElementType;

interface Props {
  schedule: Schedule;
  onRequestAuth: () => void;
  onLogout: () => void;
}

export function ProfilePage({ schedule, onRequestAuth, onLogout }: Props) {
  const { user, updateDisplayName } = useAuth();
  const streak = useStreak(schedule);
  const earnedTier = getBadgeTier(streak);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Learner';
  const photoURL = user?.photoURL;
  const email = user?.email;

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Show celebration when badge tier changes
  useEffect(() => {
    if (earnedTier) {
      setShowBadgeCelebration(earnedTier);
      const t = setTimeout(() => setShowBadgeCelebration(null), 4000);
      return () => clearTimeout(t);
    }
  }, [earnedTier]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === displayName) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  const nextBadge = BADGES.find((b) => !earnedTier || BADGES.findIndex(x => x.tier === earnedTier) < BADGES.findIndex(x => x.tier === b.tier));
  const nextMilestone = nextBadge?.days ?? null;
  const progressToNext = nextMilestone ? Math.min((streak / nextMilestone) * 100, 100) : 100;

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 space-y-6 px-1">
      {/* Celebration overlay */}
      <AnimatePresence>
        {showBadgeCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed inset-x-4 top-6 z-50 flex justify-center pointer-events-none"
          >
            <div className="bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold">
              <span className="text-xl">{BADGES.find(b => b.tier === showBadgeCelebration)?.emoji}</span>
              <span>{BADGES.find(b => b.tier === showBadgeCelebration)?.label} earned! 🎉</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 className="font-display font-medium text-2xl sm:text-3xl text-primary">My Profile</h1>
        <p className="text-text-muted text-sm mt-1">Your learning identity and achievements</p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-border-strong rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-border-strong shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary to-accent/70 flex items-center justify-center shadow-lg ring-4 ring-border-strong">
                <span className="text-white font-display font-bold text-3xl">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            {photoURL && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-border-strong flex items-center justify-center shadow-sm">
                <Camera className="w-3.5 h-3.5 text-text-muted" />
              </div>
            )}
            {!photoURL && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-border-strong flex items-center justify-center shadow-sm">
                <User className="w-3.5 h-3.5 text-text-muted" />
              </div>
            )}
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            {user ? (
              <>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName();
                          if (e.key === 'Escape') { setEditingName(false); setNameDraft(displayName); }
                        }}
                        className="font-display font-medium text-xl text-primary border-b-2 border-primary bg-transparent outline-none w-40 sm:w-52"
                        maxLength={40}
                      />
                      <button onClick={saveName} disabled={savingName} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingName(false); setNameDraft(displayName); }} className="text-text-muted hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-display font-semibold text-xl sm:text-2xl text-primary truncate">{displayName}</h2>
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-text-muted hover:text-primary transition-colors shrink-0"
                        title="Edit name"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {email && <p className="text-text-muted text-sm mt-1 truncate">{email}</p>}
                {photoURL && (
                  <p className="text-text-muted text-xs mt-1 flex items-center gap-1 justify-center sm:justify-start">
                    <svg className="w-3 h-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Photo from Google account
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="font-display font-semibold text-xl text-primary">Guest Learner</h2>
                <p className="text-text-muted text-sm mt-1">Sign in to save your progress across devices</p>
              </>
            )}

            {/* Sign in / out */}
            <div className="mt-4 flex gap-2 justify-center sm:justify-start">
              {user ? (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-strong text-sm font-medium text-text-secondary hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              ) : (
                <button
                  onClick={onRequestAuth}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Streak section */}
      <div className="bg-white border border-border-strong rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-semibold text-sm text-text-secondary uppercase tracking-widest">Daily Streak</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="font-display font-bold text-5xl sm:text-6xl text-primary tabular-nums">{streak}</span>
              <span className="font-medium text-text-muted mb-2 text-lg">day{streak !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-text-muted text-sm mt-1">
              {streak === 0
                ? 'Complete all tasks today to start your streak!'
                : streak < 7
                ? `${7 - streak} more day${7 - streak !== 1 ? 's' : ''} to reach Silver`
                : streak < 14
                ? `${14 - streak} more day${14 - streak !== 1 ? 's' : ''} to reach Gold`
                : streak < 30
                ? `${30 - streak} more day${30 - streak !== 1 ? 's' : ''} to reach Diamond`
                : 'Diamond achieved! Keep the fire burning! 🔥'}
            </p>
          </div>

          {/* Streak fire animation */}
          <div className="shrink-0">
            {streak > 0 ? (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-300/40"
              >
                <span className="text-3xl sm:text-4xl">🔥</span>
              </motion.div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-canvas border border-border-strong flex items-center justify-center">
                <span className="text-3xl sm:text-4xl opacity-30">🔥</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress to next badge */}
        {nextMilestone && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span>Progress to {nextBadge?.label}</span>
              <span className="font-semibold">{streak} / {nextMilestone}</span>
            </div>
            <div className="h-2.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Badges section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-text-secondary" />
          <h2 className="font-semibold text-text-secondary uppercase tracking-widest text-sm">Badges</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BADGES.map((badge) => {
            const isEarned = earnedTier !== null &&
              BADGES.findIndex(b => b.tier === earnedTier) >= BADGES.findIndex(b => b.tier === badge.tier);
            return (
              <BadgeCard key={badge.tier} badge={badge} earned={isEarned} streak={streak} />
            );
          })}
        </div>
      </div>

      {/* How streak works */}
      <div className="bg-canvas rounded-2xl border border-border-strong p-5">
        <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
          <span>📖</span> How streaks work
        </h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            Complete <strong>all tasks</strong> in your active workspace on a given day
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            Your streak increments for each consecutive completed day
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            Missing a day resets the streak back to zero
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">•</span>
            Earn <strong>Silver</strong> (7 days), <strong>Gold</strong> (14 days), <strong>Diamond</strong> (30 days)
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---- Badge Card ---------------------------------------------------------------

interface BadgeCardProps {
  badge: typeof BADGES[number];
  earned: boolean;
  streak: number;
}

const BADGE_STYLES: Record<string, { ring: string; glow: string; shimmer: string }> = {
  silver: {
    ring: 'ring-2 ring-slate-300',
    glow: 'shadow-[0_4px_24px_0_rgba(148,163,184,0.5)]',
    shimmer: 'via-white/60',
  },
  gold: {
    ring: 'ring-2 ring-amber-300',
    glow: 'shadow-[0_4px_24px_0_rgba(251,191,36,0.55)]',
    shimmer: 'via-yellow-100/70',
  },
  diamond: {
    ring: 'ring-2 ring-cyan-300',
    glow: 'shadow-[0_4px_24px_0_rgba(34,211,238,0.55)]',
    shimmer: 'via-cyan-100/70',
  },
};

function BadgeCard({ badge, earned, streak }: BadgeCardProps) {
  const [showLottie, setShowLottie] = useState(false);
  const styles = BADGE_STYLES[badge.tier];
  const daysUntil = Math.max(0, badge.days - streak);
  const progress = Math.min((streak / badge.days) * 100, 100);

  useEffect(() => {
    if (earned) {
      const t = setTimeout(() => setShowLottie(true), 400);
      return () => clearTimeout(t);
    } else {
      setShowLottie(false);
    }
  }, [earned]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
        earned
          ? `bg-white ${badge.borderColor} ${styles.ring} ${styles.glow}`
          : 'bg-white border-border-strong'
      }`}
    >
      {/* Shimmer sweep on earned */}
      {earned && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <motion.div
            animate={{ x: ['-100%', '250%'] }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
            className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent ${styles.shimmer} to-transparent -skew-x-12`}
          />
        </div>
      )}

      <div className="p-5 flex flex-col items-center text-center gap-3">
        {/* Large badge icon with gradient circle */}
        <div className="relative">
          <motion.div
            animate={earned ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${badge.gradient} flex items-center justify-center shadow-md ${earned ? styles.glow : 'grayscale opacity-40'}`}
          >
            {earned && showLottie ? (
              <DotLottie
                src={badge.lottieUrl}
                style={{ width: '64px', height: '64px' }}
                autoplay
                loop
              />
            ) : (
              <span className="text-4xl select-none">
                {earned ? badge.emoji : '🔒'}
              </span>
            )}
          </motion.div>
          {earned && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white"
            >
              <CheckIcon className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </div>

        {/* Name + milestone */}
        <div>
          <div className={`font-display font-bold text-lg leading-tight ${earned ? badge.textColor : 'text-text-muted'}`}>
            {badge.label}
          </div>
          <div className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            earned
              ? `${badge.bgLight} ${badge.textColor} ${badge.borderColor}`
              : 'bg-canvas text-text-muted border-border-strong'
          }`}>
            <Flame className="w-3 h-3" />
            {badge.days} day streak
          </div>
        </div>

        {/* Description */}
        <p className={`text-xs leading-relaxed ${earned ? 'text-text-secondary' : 'text-text-muted'}`}>
          {badge.description}
        </p>

        {/* Progress bar (only when not yet earned) */}
        {!earned && (
          <div className="w-full">
            <div className="flex justify-between text-[10px] text-text-muted mb-1">
              <span>{streak} days</span>
              <span>{badge.days} days</span>
            </div>
            <div className="h-1.5 bg-border-subtle rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${badge.gradient}`}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1.5 font-medium">
              {daysUntil} more day{daysUntil !== 1 ? 's' : ''} to unlock
            </p>
          </div>
        )}

        {/* Earned stamp */}
        {earned && (
          <div className={`w-full py-1.5 rounded-xl text-xs font-bold text-center ${badge.bgLight} ${badge.textColor}`}>
            ✓ Badge Earned!
          </div>
        )}
      </div>
    </motion.div>
  );
}

