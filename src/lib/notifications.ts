import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { supabase } from './supabase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Requests notification permission, gets an FCM token, and saves it to
 * Supabase so the daily Cloud Function can send reminders to this device.
 * Safe to call multiple times — upserts on user_id.
 */
export async function registerPushNotifications(userId: string): Promise<void> {
  if (!VAPID_KEY) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return;

    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (err) {
    // Never block the app — push is best-effort.
    console.warn('[SkillPath] Push registration failed:', err);
  }
}

/** Removes the push token from Supabase (call on logout). */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch {
    // ignore
  }
}
