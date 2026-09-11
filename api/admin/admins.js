const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { hasCapability, getSession } = require('../_lib/auth');
const { ROLES } = require('../_lib/permissions');
const { readDb, writeDb } = require('../_lib/db');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (!hasCapability(req, 'manage_admins')) return res.status(403).json({ error: 'You do not have permission to manage admin accounts.' });

  try {
    const db = await readDb();

    if (req.method === 'GET') {
      // Never send password hashes to the client.
      const admins = db.admins.map((a) => ({
        id: a.id, username: a.username, permRole: a.permRole, createdAt: a.createdAt
      }));
      return res.status(200).json({ admins, roles: Object.keys(ROLES) });
    }

    if (req.method === 'POST' && req.query.action === 'update') {
      const { id, permRole, password } = parseBody(req);
      if (!id) return res.status(400).json({ error: 'Missing admin id.' });

      const target = db.admins.find((a) => a.id === id);
      if (!target) return res.status(404).json({ error: 'Admin not found.' });

      if (permRole !== undefined) {
        if (!Object.prototype.hasOwnProperty.call(ROLES, permRole)) {
          return res.status(400).json({ error: 'Invalid role.' });
        }
        target.permRole = permRole;
      }
      if (password) {
        if (String(password).length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }
        target.passwordHash = bcrypt.hashSync(String(password), 10);
      }

      await writeDb(db);
      return res.status(200).json({ ok: true, admin: { id: target.id, username: target.username, permRole: target.permRole, createdAt: target.createdAt } });
    }

    if (req.method === 'POST') {
      const { username, password, permRole } = parseBody(req);
      const cleanUsername = String(username || '').trim().slice(0, 60);
      const cleanRole = Object.prototype.hasOwnProperty.call(ROLES, permRole) ? permRole : 'reviewer';

      if (!cleanUsername || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      if (process.env.ADMIN_USER && cleanUsername === process.env.ADMIN_USER) {
        return res.status(409).json({ error: 'That username is reserved for the bootstrap Owner account.' });
      }
      if (db.admins.find((a) => a.username === cleanUsername)) {
        return res.status(409).json({ error: 'An admin with that username already exists.' });
      }

      const admin = {
        id: crypto.randomBytes(8).toString('hex'),
        username: cleanUsername,
        passwordHash: bcrypt.hashSync(String(password), 10),
        permRole: cleanRole,
        createdAt: Date.now()
      };
      db.admins.push(admin);
      await writeDb(db);
      return res.status(200).json({ ok: true, admin: { id: admin.id, username: admin.username, permRole: admin.permRole, createdAt: admin.createdAt } });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing admin id.' });

      const target = db.admins.find((a) => a.id === id);
      if (!target) return res.status(404).json({ error: 'Admin not found.' });

      const session = getSession(req);
      if (session && session.username === target.username) {
        return res.status(400).json({ error: "You can't remove the account you're currently logged in as." });
      }

      db.admins = db.admins.filter((a) => a.id !== id);
      await writeDb(db);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('admins error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
