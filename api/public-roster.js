// GET /api/public-roster
// No authentication — this is the public-facing endpoint behind the
// /roster page. Deliberately returns a minimal, safe field set: no
// Discord ID, no promotion history, no application linkage. Only active
// (non-discharged) personnel are included.

const { readDb } = require('./_lib/db');
const { RANKS } = require('./_lib/ranks');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const db = await readDb();
    const roster = db.roster
      .filter((r) => r.status !== 'discharged')
      .sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || a.charname.localeCompare(b.charname))
      .map((r) => ({
        id: r.id,
        charname: r.charname,
        rank: r.rank,
        imageUrl: r.imageUrl || '',
        description: r.description || ''
      }));

    res.status(200).json({ roster, ranks: RANKS });
  } catch (err) {
    console.error('public-roster error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
