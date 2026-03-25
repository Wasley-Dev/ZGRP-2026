import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_KEY =
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const sha256Hex = (value) => createHash('sha256').update(String(value || ''), 'utf8').digest('hex');

const html = (res, status, title, message) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#081024; color:#fff; margin:0; padding:40px; }
    .card { max-width:640px; margin:0 auto; background: rgba(255,255,255,0.06); border:1px solid rgba(212,175,55,0.25); border-radius:24px; padding:24px; }
    h1 { font-size:18px; margin:0; letter-spacing:0.08em; text-transform:uppercase; color:#D4AF37; }
    p { margin:14px 0 0; line-height:1.6; color: rgba(255,255,255,0.85); }
    .meta { margin-top:16px; font-size:12px; color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="meta">Zaya Group Portal • Approval Service</div>
  </div>
</body>
</html>`);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return html(res, 200, 'OK', 'Preflight OK.');
  if (req.method !== 'GET') return html(res, 405, 'Method Not Allowed', 'Use the link provided in the authorization email.');

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = String(url.searchParams.get('id') || '').trim();
    const action = String(url.searchParams.get('action') || '').trim().toLowerCase();
    const token = String(url.searchParams.get('token') || '').trim();

    if (!id || !token || (action !== 'approve' && action !== 'deny')) {
      return html(res, 400, 'Invalid Request', 'This approval link is incomplete or invalid.');
    }

    if (!supabase) {
      return html(
        res,
        500,
        'Service Not Configured',
        'Server environment variables are missing. Configure SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel.'
      );
    }

    const { data, error } = await supabase
      .from('attendance_checkout_requests')
      .select('id,status,token_hash,user_id,date')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return html(res, 500, 'Server Error', 'Unable to load approval request.');
    }
    if (!data) {
      return html(res, 404, 'Not Found', 'This approval request no longer exists.');
    }

    const expected = String(data.token_hash || '');
    const actual = sha256Hex(token);
    if (!expected || expected !== actual) {
      return html(res, 403, 'Forbidden', 'This approval token is invalid.');
    }

    const nextStatus = action === 'approve' ? 'approved' : 'denied';
    if (data.status === nextStatus) {
      return html(res, 200, `Already ${nextStatus.toUpperCase()}`, 'No further action is required.');
    }

    const update = await supabase
      .from('attendance_checkout_requests')
      .update({ status: nextStatus, decided_at: new Date().toISOString() })
      .eq('id', id);
    if (update.error) {
      return html(res, 500, 'Update Failed', 'Unable to save the approval decision.');
    }

    return html(
      res,
      200,
      action === 'approve' ? 'Approved' : 'Denied',
      `Decision saved for ${data.user_id} (${data.date}). The employee will see the update automatically.`
    );
  } catch (error) {
    return html(res, 500, 'Unhandled Error', error instanceof Error ? error.message : 'Unexpected server error.');
  }
}
