const { verifyRequest } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (!verifyRequest(req)) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    if (req.method === 'GET') {
      const db = await readDb();
      return res.status(200).json({ sheetWebhookUrl: db.config.sheetWebhookUrl || '' });
    }
    if (req.method === 'POST') {
      const db = await readDb();
      const body = parseBody(req);
      db.config.sheetWebhookUrl = String(body.sheetWebhookUrl || '').slice(0, 500);
      await writeDb(db);
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('config error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
