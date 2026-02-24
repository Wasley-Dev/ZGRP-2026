export const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.end(JSON.stringify(body));
};

export const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const toTwilioAuthHeader = () => {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  if (!sid || !token) return null;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
};

const normalizeSmsStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (['queued', 'accepted', 'scheduled'].includes(s)) return 'QUEUED';
  if (['sending', 'sent'].includes(s)) return 'SENT';
  if (['delivered', 'read'].includes(s)) return 'DELIVERED';
  if (['failed', 'undelivered', 'canceled'].includes(s)) return 'FAILED';
  return 'UNKNOWN';
};

export const sendTwilioSms = async ({ to, body }) => {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const from = (process.env.TWILIO_MESSAGING_FROM || process.env.VITE_SMS_SENDER || '').trim();
  const auth = toTwilioAuthHeader();
  if (!sid || !from || !auth) {
    throw new Error('Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_FROM.');
  }
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Twilio send failed (${response.status})`);
  }
  return payload;
};

export const lookupTwilioStatus = async (providerMessageId) => {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const auth = toTwilioAuthHeader();
  if (!sid || !auth) {
    throw new Error('Twilio status lookup is not configured.');
  }
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${providerMessageId}.json`, {
    headers: { Authorization: auth },
  });
  const payload = await response.json();
  if (!response.ok) {
    return {
      providerMessageId,
      status: 'UNKNOWN',
      failedReason: payload?.message || `Lookup failed (${response.status})`,
    };
  }
  return {
    providerMessageId,
    status: normalizeSmsStatus(payload?.status),
    deliveredAt: payload?.date_updated || payload?.date_sent,
    failedReason: payload?.error_message || undefined,
  };
};

export const sendResendEmail = async ({ to, subject, body }) => {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.COMM_EMAIL_FROM || process.env.VITE_EMAIL_SENDER || 'customercare@zayagroupltd.com').trim();
  if (!apiKey) {
    throw new Error('Email backend is not configured. Set RESEND_API_KEY.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Email send failed (${response.status})`);
  }
  return payload;
};
