const { json, readBody, lookupTwilioStatus } = require('../../../_lib/transport.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const providerMessageIds = Array.isArray(body?.providerMessageIds)
      ? body.providerMessageIds.filter(Boolean)
      : [];
    if (!providerMessageIds.length) return json(res, 200, { receipts: [] });

    const receipts = await Promise.all(providerMessageIds.map((id) => lookupTwilioStatus(String(id))));
    return json(res, 200, { receipts });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Unhandled server error',
    });
  }
};
