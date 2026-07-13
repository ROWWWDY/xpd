const { hasCapability } = require('../_lib/auth');
const { readDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  if (req.query.view === 'iplog') {
    if (!hasCapability(req, 'view_security_log')) return res.status(403).json({ error: 'You do not have permission to view the security log.' });
    try {
      const db = await readDb();
      const entries = [...db.ipLog].sort((a, b) => b.ts - a.ts);
      return res.status(200).json({ entries });
    } catch (err) {
      console.error('iplog error:', err);
      return res.status(500).json({ error: 'Could not reach the database.' });
    }
  }

  if (!hasCapability(req, 'view_applications')) return res.status(403).json({ error: 'You do not have permission to view applications.' });

  try {
    const db = await readDb();
    const sorted = [...db.applications].sort((a, b) => b.ts - a.ts);

    // IP addresses are tracked separately for security purposes only.
    // They never travel through the normal applications list/review flow,
    // regardless of role.
    const visible = sorted.map(({ ip, ...rest }) => rest);

    res.status(200).json({ applications: visible });
  } catch (err) {
    console.error('applications list error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
