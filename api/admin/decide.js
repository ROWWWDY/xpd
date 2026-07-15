// Also handles deletion (folded in from what used to be a separate
// delete.js) to keep the total function count under Vercel's Hobby plan
// limit — see api/admin/auth.js for the same reasoning.

const { hasCapability, getSession } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');
const { RANKS } = require('../_lib/ranks');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

function reopenInvite(db, application) {
  if (!application.inviteId) return;
  const invite = db.invites.find((i) => i.id === application.inviteId);
  if (invite) {
    invite.used = false;
    invite.usedAt = null;
    invite.applicationId = null;
  }
}

// Creates the roster entry the moment someone is Accepted — this is the
// "automated roster update" hook. If they already have a roster entry
// (e.g. re-accepted after being discharged), it's left alone rather than
// overwritten, so promotion history isn't lost.
function ensureRosterEntry(db, application, acceptedBy) {
  const existing = db.roster.find((r) => r.discordId === application.discordId);
  if (existing) return existing;

  const entry = {
    id: application.id + '-roster',
    applicationId: application.id,
    charname: application.charname,
    discordName: application.discordName,
    discordId: application.discordId,
    rank: RANKS[0],
    status: 'active',
    joinDate: new Date().toLocaleString(),
    imageUrl: '',
    description: '',
    promotionHistory: [{ rank: RANKS[0], date: new Date().toLocaleString(), by: acceptedBy, note: 'Accepted into the department' }]
  };
  db.roster.push(entry);
  return entry;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const id = req.query.id;
  const { action } = parseBody(req);
  if (!id) return res.status(400).json({ error: 'Missing application id.' });
  if (!['accepted', 'rejected', 'deleted'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  const requiredCapability = action === 'deleted' ? 'delete_applications' : 'decide_applications';
  if (!hasCapability(req, requiredCapability)) {
    return res.status(403).json({ error: 'You do not have permission to do that.' });
  }

  try {
    const db = await readDb();
    const application = db.applications.find((a) => a.id === id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    if (action === 'deleted') {
      db.applications = db.applications.filter((a) => a.id !== id);
      reopenInvite(db, application);
      await writeDb(db);
      return res.status(200).json({ ok: true });
    }

    const session = getSession(req);
    const reviewer = (session && session.username) || 'unknown';

    application.status = action;
    application.reviewedBy = reviewer;
    application.reviewedAt = new Date().toLocaleString();

    if (action === 'rejected') reopenInvite(db, application);
    if (action === 'accepted') ensureRosterEntry(db, application, reviewer);

    await writeDb(db);

    const sheetUrl = db.config.sheetWebhookUrl;
    if (sheetUrl) {
      try {
        // Never send the applicant's IP to the sheet — that spreadsheet may
        // be visible to people who shouldn't see it at all.
        const { ip, ...sheetPayload } = application;
        await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(sheetPayload)
        });
      } catch (err) {
        // Don't fail the accept/reject action just because the sheet is unreachable.
        console.error('Google Sheet webhook failed:', err.message);
      }
    }

    const { ip, ...responseApplication } = application;

    res.status(200).json({ ok: true, application: responseApplication });
  } catch (err) {
    console.error('decide error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
