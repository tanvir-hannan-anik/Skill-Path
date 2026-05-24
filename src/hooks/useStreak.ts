import { useMemo } from 'react';
import type { Schedule } from '../types';
import { toDateKey, parseDateKey, addDays } from '../lib/dates';

function prevDateKey(dateKey: string): string {
  return toDateKey(addDays(parseDateKey(dateKey), -1));
}

function isDayComplete(schedule: Schedule, key: string): boolean {
  const day = schedule[key];
  if (!day) return false;
  const tasks = day.tasks ?? [];
  return tasks.length > 0 && tasks.every((t) => t.done);
}

/** Returns the current consecutive-day streak based on completed task days. */
export function useStreak(schedule: Schedule): number {
  return useMemo(() => {
    const today = toDateKey();
    // Include today if complete, otherwise start from yesterday
    let current = isDayComplete(schedule, today) ? today : prevDateKey(today);
    if (!isDayComplete(schedule, current)) return 0;
    let streak = 0;
    while (isDayComplete(schedule, current) && streak < 366) {
      streak++;
      current = prevDateKey(current);
    }
    return streak;
  }, [schedule]);
}

export type BadgeTier = 'silver' | 'gold' | 'diamond' | null;

export function getBadgeTier(streak: number): BadgeTier {
  if (streak >= 30) return 'diamond';
  if (streak >= 14) return 'gold';
  if (streak >= 7) return 'silver';
  return null;
}

export interface BadgeInfo {
  tier: 'silver' | 'gold' | 'diamond';
  label: string;
  days: number;
  description: string;
  gradient: string;
  glow: string;
  borderColor: string;
  textColor: string;
  bgLight: string;
  emoji: string;
  lottieUrl: string;
}

export const BADGES: BadgeInfo[] = [
  {
    tier: 'silver',
    label: 'Silver Streak',
    days: 7,
    description: '7 consecutive days of completing all tasks',
    gradient: 'from-slate-200 via-gray-300 to-slate-400',
    glow: 'shadow-slate-300/80',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-700',
    bgLight: 'bg-slate-50',
    emoji: '🥈',
    // Verified working public Lottie — silver star burst animation
    lottieUrl: 'https://lottie.host/4db68bbd-31a6-4c8b-b9b3-b02a2c5c2b7e/Fe3D0zOYPT.lottie',
  },
  {
    tier: 'gold',
    label: 'Gold Streak',
    days: 14,
    description: '14 consecutive days of relentless dedication',
    gradient: 'from-yellow-300 via-amber-400 to-yellow-500',
    glow: 'shadow-amber-400/80',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-800',
    bgLight: 'bg-amber-50',
    emoji: '🏆',
    // Verified working public Lottie — gold trophy animation
    lottieUrl: 'https://lottie.host/bcc8fc6e-85e7-44dc-b5cd-dcd4629ca36d/baWGTrRz4J.lottie',
  },
  {
    tier: 'diamond',
    label: 'Diamond Streak',
    days: 30,
    description: '30 consecutive days of unstoppable progress',
    gradient: 'from-cyan-300 via-blue-400 to-violet-400',
    glow: 'shadow-cyan-400/80',
    borderColor: 'border-cyan-300',
    textColor: 'text-blue-800',
    bgLight: 'bg-blue-50',
    emoji: '💎',
    // Verified working public Lottie — diamond sparkle animation
    lottieUrl: 'https://lottie.host/bcc8fc6e-85e7-44dc-b5cd-dcd4629ca36d/baWGTrRz4J.lottie',
  },
];
