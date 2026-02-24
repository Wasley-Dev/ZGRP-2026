const { json, readBody, sendResendEmail } = require('../../_lib/transport');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const recipients = Array.isArray(body?.to) ? body.to.filter(Boolean) : [];
    const subject = String(body?.subject || 'ZAYA GROUP Notification').trim();
    const text = String(body?.body || '').trim();
    if (!recipients.length || !text) {
      return json(res, 400, { error: 'to[] and body are required.' });
    }

    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          const sent = await sendResendEmail({ to: recipient, subject, body: text });
          return {
            recipient,
            providerMessageId: sent?.id || '',
            status: 'SENT',
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
      requestId: `email-${Date.now()}`,
      accepted,
      failed,
      results,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Unhandled server error',
    });
  }
};
