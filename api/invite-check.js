const { readDb } = require('./_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const token = req.query.token;
  if (!token) return res.status(200).json({ valid: false, reason: 'missing' });

  try {
    const db = await readDb();
    const invite = db.invites.find((i) => i.id === token);

    if (!invite) return res.status(200).json({ valid: false, reason: 'not_found' });
    if (invite.used) return res.status(200).json({ valid: false, reason: 'used' });

    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error('invite-check error:', err);
    res.status(500).json({ valid: false, reason: 'server_error', detail: err.message || String(err) });
  }
};
