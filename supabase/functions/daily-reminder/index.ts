import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROJECT_ID = 'skillpath-9e635';
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

// ── JWT / OAuth2 helpers ────────────────────────────────────────────────────

function pemToBytes(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64url(obj: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)).buffer);
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key).buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${toBase64Url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`OAuth2 error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── FCM send ─────────────────────────────────────────────────────────────────

async function sendPush(token: string, title: string, body: string, accessToken: string) {
  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: {
          notification: { icon: '/LOGO.png', badge: '/LOGO.png' },
          fcm_options: { link: 'https://skillpath-9e635.web.app' },
        },
      },
    }),
  });
  return res.ok ? null : (await res.json() as { error?: { code?: number; status?: string } }).error?.status;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  // Simple shared-secret auth so only cron-job.org can trigger this.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT secret not set');
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const today = new Date().toISOString().slice(0, 10);

    // Load all FCM tokens.
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('user_id, token');
    if (error) throw error;
    if (!tokens?.length) return new Response('No tokens', { status: 200 });

    const accessToken = await getAccessToken(serviceAccount);
    const results: string[] = [];

    for (const { user_id, token } of tokens) {
      // Check for incomplete tasks today.
      const { data: record } = await supabase
        .from('daily_tasks')
        .select('data')
        .eq('user_id', user_id)
        .eq('date', today)
        .maybeSingle();

      if (!record?.data) continue;
      const { tasks = [], doneIds = [] } = record.data as {
        tasks: { id: string }[];
        doneIds: string[];
      };
      const remaining = tasks.filter((t) => !doneIds.includes(t.id)).length;
      if (remaining === 0) continue;

      const body = remaining === 1
        ? 'You still have 1 task to complete today!'
        : `You have ${remaining} tasks left for today — keep your streak going!`;

      const errStatus = await sendPush(token, '📚 SkillPath reminder', body, accessToken);

      // Remove stale tokens.
      if (errStatus === 'UNREGISTERED' || errStatus === 'INVALID_ARGUMENT') {
        await supabase.from('push_tokens').delete().eq('user_id', user_id);
        results.push(`${user_id}: removed stale token`);
      } else {
        results.push(`${user_id}: sent (${errStatus ?? 'ok'})`);
      }
    }

    return new Response(JSON.stringify({ date: today, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
