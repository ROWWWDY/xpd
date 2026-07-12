const { verifyRequest } = require('../_lib/auth');
const { readDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (!verifyRequest(req)) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const db = await readDb();
    const sorted = [...db.applications].sort((a, b) => b.ts - a.ts);
    res.status(200).json({ applications: sorted });
  } catch (err) {
    console.error('applications list error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
