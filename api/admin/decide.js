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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const id = req.query.id;
  const { action } = parseBody(req);

  if (!id) return res.status(400).json({ error: 'Missing application id.' });
  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  try {
    const db = await readDb();
    const application = db.applications.find((a) => a.id === id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    application.status = action;
    application.reviewedBy = process.env.ADMIN_USER;
    application.reviewedAt = new Date().toLocaleString();

    if (action === 'rejected' && application.inviteId) {
      const invite = db.invites.find((i) => i.id === application.inviteId);
      if (invite) {
        invite.used = false;
        invite.usedAt = null;
        invite.applicationId = null;
      }
    }

    await writeDb(db);

    const sheetUrl = db.config.sheetWebhookUrl;
    if (sheetUrl) {
      // Fire-and-forget — don't make the admin wait on Google's response.
      fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(application)
      }).catch((err) => console.error('Google Sheet webhook failed:', err.message));
    }

    res.status(200).json({ ok: true, application });
  } catch (err) {
    console.error('decide error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
