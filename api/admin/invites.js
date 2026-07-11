const crypto = require('crypto');
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
    const db = await readDb();

    if (req.method === 'GET') {
      const sorted = [...db.invites].sort((a, b) => b.createdAt - a.createdAt);
      return res.status(200).json({ invites: sorted });
    }

    if (req.method === 'POST') {
      const { label, quantity } = parseBody(req);
      const qty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 50);

      const created = [];
      for (let n = 0; n < qty; n++) {
        const invite = {
          id: crypto.randomBytes(10).toString('hex'),
          label: String(label || '').trim().slice(0, 100),
          used: false,
          createdAt: Date.now(),
          usedAt: null,
          applicationId: null
        };
        db.invites.push(invite);
        created.push(invite);
      }
      await writeDb(db);
      return res.status(200).json({ ok: true, invites: created });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing invite id.' });
      const before = db.invites.length;
      db.invites = db.invites.filter((i) => i.id !== id);
      if (db.invites.length === before) return res.status(404).json({ error: 'Invite not found.' });
      await writeDb(db);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('invites error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
