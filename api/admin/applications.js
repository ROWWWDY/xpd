// Also serves the security IP log (folded in from what used to be a
// separate iplog.js) to keep the total function count under Vercel's
// Hobby plan limit — see api/admin/auth.js for the same reasoning.
// GET    /api/admin/applications                              -> normal application list
// GET    /api/admin/applications?view=iplog                    -> security log
// DELETE /api/admin/applications?view=iplog&id=X                -> remove one log entry
// DELETE /api/admin/applications?view=iplog&clearAll=true       -> remove all log entries

const { hasCapability } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.query.view === 'iplog') {
    if (req.method === 'GET') {
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

    if (req.method === 'DELETE') {
      if (!hasCapability(req, 'manage_security_log')) return res.status(403).json({ error: 'You do not have permission to clear the security log.' });
      try {
        const db = await readDb();
        if (req.query.clearAll === 'true') {
          db.ipLog = [];
        } else {
          const id = req.query.id;
          if (!id) return res.status(400).json({ error: 'Missing log entry id.' });
          db.ipLog = db.ipLog.filter((e) => e.id !== id);
        }
        await writeDb(db);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error('iplog delete error:', err);
        return res.status(500).json({ error: 'Could not reach the database.' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
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
