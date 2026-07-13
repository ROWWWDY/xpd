// GET    /api/admin/roster                          -> list all roster entries
// POST   /api/admin/roster?action=add                body { discordName, discordId, charname, rank? }
// POST   /api/admin/roster?action=edit                body { id, discordName?, charname?, discordId?, rank? }
// POST   /api/admin/roster?action=promote             body { id }        -> one step up RANKS
// POST   /api/admin/roster?action=demote              body { id }        -> one step down RANKS
// POST   /api/admin/roster?action=setRank             body { id, rank }  -> jump straight to a rank
// POST   /api/admin/roster?action=discharge           body { id, note }  -> mark inactive
// POST   /api/admin/roster?action=reactivate          body { id }        -> mark active again
// DELETE /api/admin/roster?id=X                       -> permanently remove an entry
//
// Everyone with the view_roster capability can GET. Every mutation
// (add/edit/promote/demote/discharge/reactivate/delete) requires
// manage_roster, which is Owner-only by default.

const crypto = require('crypto');
const { hasCapability, getSession } = require('../_lib/auth');
const { readDb, writeDb } = require('../_lib/db');
const { RANKS, isValidRank, nextRank, previousRank } = require('../_lib/ranks');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    if (!hasCapability(req, 'view_roster')) return res.status(403).json({ error: 'You do not have permission to view the roster.' });
    try {
      const db = await readDb();
      const sorted = [...db.roster].sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || a.charname.localeCompare(b.charname));
      return res.status(200).json({ roster: sorted, ranks: RANKS });
    } catch (err) {
      console.error('roster list error:', err);
      return res.status(500).json({ error: 'Could not reach the database.' });
    }
  }

  if (!hasCapability(req, 'manage_roster')) return res.status(403).json({ error: 'You do not have permission to manage the roster.' });

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing roster entry id.' });
    try {
      const db = await readDb();
      const before = db.roster.length;
      db.roster = db.roster.filter((r) => r.id !== id);
      if (db.roster.length === before) return res.status(404).json({ error: 'Roster entry not found.' });
      await writeDb(db);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('roster delete error:', err);
      return res.status(500).json({ error: 'Could not reach the database.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const action = req.query.action;
  const body = parseBody(req);
  const session = getSession(req);
  const actor = (session && session.username) || 'unknown';
  const now = new Date().toLocaleString();

  try {
    const db = await readDb();

    // Manually add someone who skips the application form entirely — e.g.
    // existing PD management being entered into the system for the first time.
    if (action === 'add') {
      const charname = String(body.charname || '').trim().slice(0, 100);
      const discordName = String(body.discordName || '').trim().slice(0, 100);
      const discordId = String(body.discordId || '').trim().slice(0, 100);
      const rank = isValidRank(body.rank) ? body.rank : RANKS[RANKS.length - 1];

      if (!charname || !discordName || !discordId) {
        return res.status(400).json({ error: 'Character name, Discord name, and Discord ID are required.' });
      }
      if (db.roster.find((r) => r.discordId === discordId)) {
        return res.status(409).json({ error: 'Someone with that Discord ID is already on the roster.' });
      }

      const entry = {
        id: crypto.randomBytes(8).toString('hex'),
        applicationId: null,
        charname,
        discordName,
        discordId,
        rank,
        status: 'active',
        joinDate: now,
        promotionHistory: [{ rank, date: now, by: actor, note: 'Added directly by management (no application on file)' }]
      };
      db.roster.push(entry);
      await writeDb(db);
      return res.status(200).json({ ok: true, entry });
    }

    // Everything past this point operates on an existing entry.
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing roster entry id.' });
    const entry = db.roster.find((r) => r.id === id);
    if (!entry) return res.status(404).json({ error: 'Roster entry not found.' });

    if (action === 'edit') {
      if (body.charname !== undefined) entry.charname = String(body.charname).trim().slice(0, 100);
      if (body.discordName !== undefined) entry.discordName = String(body.discordName).trim().slice(0, 100);
      if (body.discordId !== undefined) {
        const newId = String(body.discordId).trim().slice(0, 100);
        if (newId !== entry.discordId && db.roster.find((r) => r.id !== id && r.discordId === newId)) {
          return res.status(409).json({ error: 'Someone with that Discord ID is already on the roster.' });
        }
        entry.discordId = newId;
      }
      if (body.rank !== undefined && body.rank !== entry.rank) {
        if (!isValidRank(body.rank)) return res.status(400).json({ error: 'Invalid rank.' });
        entry.rank = body.rank;
        entry.promotionHistory.push({ rank: body.rank, date: now, by: actor, note: 'Rank edited' });
      }
    } else if (action === 'promote' || action === 'demote') {
      const newRank = action === 'promote' ? nextRank(entry.rank) : previousRank(entry.rank);
      if (newRank === entry.rank) {
        return res.status(400).json({ error: action === 'promote' ? 'Already at the top rank.' : 'Already at the base rank.' });
      }
      entry.rank = newRank;
      entry.promotionHistory.push({ rank: newRank, date: now, by: actor, note: action === 'promote' ? 'Promoted' : 'Demoted' });
    } else if (action === 'setRank') {
      if (!isValidRank(body.rank)) return res.status(400).json({ error: 'Invalid rank.' });
      entry.rank = body.rank;
      entry.promotionHistory.push({ rank: body.rank, date: now, by: actor, note: 'Rank set manually' });
    } else if (action === 'discharge') {
      entry.status = 'discharged';
      entry.promotionHistory.push({ rank: entry.rank, date: now, by: actor, note: 'Discharged' + (body.note ? ': ' + String(body.note).slice(0, 200) : '') });
    } else if (action === 'reactivate') {
      entry.status = 'active';
      entry.promotionHistory.push({ rank: entry.rank, date: now, by: actor, note: 'Reactivated' });
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }

    await writeDb(db);
    res.status(200).json({ ok: true, entry });
  } catch (err) {
    console.error('roster update error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
