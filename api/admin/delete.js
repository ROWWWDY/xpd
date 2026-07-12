const { verifyRequest } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (!verifyRequest(req)) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing application id.' });

  try {
    const db = await readDb();
    const application = db.applications.find((a) => a.id === id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    db.applications = db.applications.filter((a) => a.id !== id);

    if (application.inviteId) {
      const invite = db.invites.find((i) => i.id === application.inviteId);
      if (invite) {
        invite.used = false;
        invite.usedAt = null;
        invite.applicationId = null;
      }
    }

    await writeDb(db);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
