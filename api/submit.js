function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  try {
    const { readDb, writeDb } = require('./_lib/db');
    const { ACK_SECTIONS } = require('./_lib/ackSections');

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

    const body = parseBody(req);
    const { inviteToken, discordName, discordId, charname, availability, notes, signature, date, ack } = body;

    if (!inviteToken) {
      return res.status(401).json({ error: 'Missing invite link. Open this form using your personal invite link.' });
    }
    if (!discordName || !discordId || !charname || !signature) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!Array.isArray(ack) || ack.length !== 17 || ack.some((v) => v !== true)) {
      return res.status(400).json({ error: 'All guideline items must be acknowledged.' });
    }

    const db = await readDb();

    const invite = db.invites.find((i) => i.id === inviteToken);
    if (!invite) {
      return res.status(401).json({ error: 'This invite link is not valid.' });
    }
    if (invite.used) {
      return res.status(409).json({ error: 'This invite link has already been used to submit an application.' });
    }

    const cleanDiscordId = String(discordId).trim().slice(0, 100);

    // Block a second pending/accepted application under the same self-reported Discord ID.
    const existing = db.applications.find(
      (a) => a.discordId === cleanDiscordId && (a.status === 'pending' || a.status === 'accepted')
    );
    if (existing) {
      return res.status(409).json({ error: 'An application for this Discord ID is already pending or accepted.' });
    }

    const formNumber = db.counter;
    const record = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formNumber,
      discordName: String(discordName).slice(0, 100),
      discordId: cleanDiscordId,
      charname: String(charname).slice(0, 100),
      availability: String(availability || '').slice(0, 200),
      notes: String(notes || '').slice(0, 1000),
      signature: String(signature).slice(0, 100),
      date: String(date || new Date().toLocaleString()).slice(0, 60),
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      inviteId: invite.id,
      ackSections: ACK_SECTIONS,
      ts: Date.now()
    };

    db.applications.push(record);
    db.counter = formNumber + 1;

    invite.used = true;
    invite.usedAt = Date.now();
    invite.applicationId = record.id;

    await writeDb(db);

    res.status(200).json({ ok: true, formNumber, id: record.id });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ error: 'Could not reach the database. Please try again.', detail: err.message || String(err) });
  }
};
