import { json, readBody, sendTwilioSms } from '../../_lib/transport.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const normalizePhone = (raw) => {
      const trimmed = String(raw || '').trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('+')) {
        const clean = `+${trimmed.slice(1).replace(/\D/g, '')}`;
        return clean.length >= 8 ? clean : null;
      }
      const digits = trimmed.replace(/\D/g, '');
      if (!digits) return null;
      if (digits.startsWith('255')) return `+${digits}`;
      if (digits.startsWith('0') && digits.length >= 9) return `+255${digits.slice(1)}`;
      if (digits.length >= 9 && digits.length <= 12) return `+${digits}`;
      return null;
    };
    const recipients = Array.isArray(body?.to)
      ? Array.from(new Set(body.to.map(normalizePhone).filter(Boolean)))
      : [];
    const text = String(body?.body || '').trim();
    if (!recipients.length || !text) {
      return json(res, 400, { error: 'to[] and body are required.' });
    }

    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          const sent = await sendTwilioSms({ to: recipient, body: text });
          return {
            recipient,
            providerMessageId: sent?.sid,
            status: 'QUEUED',
          };
        } catch (error) {
          return {
            recipient,
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Send failed',
          };
        }
      })
    );

    const accepted = results.filter((r) => r.status !== 'FAILED').length;
    const failed = results.length - accepted;
    return json(res, 200, {
      requestId: `sms-${Date.now()}`,
      accepted,
      failed,
      results,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Unhandled server error',
    });
  }
}
