const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { createClient } = require('@supabase/supabase-js');

initializeApp();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // service role key — set via: firebase functions:secrets:set SUPABASE_SERVICE_KEY
  );
}

/**
 * Runs every day at 09:00 UTC.
 * For each user with a push token, checks whether they have any incomplete
 * daily tasks today. If yes, sends a native push notification to their device.
 *
 * Deploy:
 *   firebase deploy --only functions
 *
 * Set secrets before deploying:
 *   firebase functions:secrets:set SUPABASE_URL
 *   firebase functions:secrets:set SUPABASE_SERVICE_KEY
 */
exports.dailyTaskReminder = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'UTC',
    secrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
  },
  async () => {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Load all FCM tokens.
    const { data: tokens, error: tokErr } = await supabase
      .from('push_tokens')
      .select('user_id, token');

    if (tokErr || !tokens?.length) return;

    const messaging = getMessaging();

    // 2. For each user check if they have incomplete tasks today.
    for (const { user_id, token } of tokens) {
      const { data: record } = await supabase
        .from('daily_tasks')
        .select('data')
        .eq('user_id', user_id)
        .eq('date', today)
        .maybeSingle();

      if (!record?.data) continue;

      const { tasks = [], doneIds = [] } = record.data;
      const incomplete = tasks.filter((t) => !doneIds.includes(t.id));
      if (incomplete.length === 0) continue;

      // 3. Send push notification.
      try {
        await messaging.send({
          token,
          notification: {
            title: '📚 SkillPath — tasks waiting',
            body: incomplete.length === 1
              ? `You still have 1 task to complete today!`
              : `You have ${incomplete.length} tasks left for today — keep your streak going!`,
          },
          webpush: {
            notification: { icon: '/LOGO.png', badge: '/LOGO.png' },
            fcmOptions: { link: 'https://skillpath-9e635.web.app' },
          },
        });
      } catch (sendErr) {
        // Token may be stale — remove it so we stop sending to dead devices.
        const code = sendErr?.errorInfo?.code ?? '';
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token') {
          await supabase.from('push_tokens').delete().eq('user_id', user_id);
        }
      }
    }
  }
);
