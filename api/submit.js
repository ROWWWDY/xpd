const { readDb, writeDb } = require('./_lib/db');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const body = parseBody(req);
  const { discordName, discordId, charname, availability, signature, date, ack } = body;

  if (!discordName || !discordId || !charname || !signature) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!Array.isArray(ack) || ack.length !== 8 || ack.some((v) => v !== true)) {
    return res.status(400).json({ error: 'All guideline items must be acknowledged.' });
  }

  try {
    const db = await readDb();
    const formNumber = db.counter;
    const record = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formNumber,
      discordName: String(discordName).slice(0, 100),
      discordId: String(discordId).slice(0, 100),
      charname: String(charname).slice(0, 100),
      availability: String(availability || '').slice(0, 200),
      signature: String(signature).slice(0, 100),
      date: String(date || new Date().toLocaleString()).slice(0, 60),
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      ts: Date.now()
    };

    db.applications.push(record);
    db.counter = formNumber + 1;
    await writeDb(db);

    res.status(200).json({ ok: true, formNumber, id: record.id });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ error: 'Could not reach the database. Please try again.' });
  }
};
