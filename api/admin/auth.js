// Combines what used to be three separate serverless functions
// (login.js, logout.js, session.js) into one file. Vercel's Hobby plan
// caps a deployment at 12 serverless functions — every extra file in
// /api counts against that limit, so related low-traffic admin actions
// get merged into a single endpoint dispatched by method/query.
//
// GET  /api/admin/auth              -> session check
// POST /api/admin/auth?action=login -> log in
// POST /api/admin/auth?action=logout -> log out

const bcrypt = require('bcryptjs');
const { checkLoginRateLimit, readDb } = require('../_lib/db');
const { setSessionCookie, clearSessionCookie, getClientIp, getSession } = require('../_lib/auth');
const { capabilitiesFor } = require('../_lib/permissions');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

async function handleLogin(req, res) {
  try {
    const ip = getClientIp(req);
    const withinLimit = await checkLoginRateLimit(ip);
    if (!withinLimit) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in a few minutes.' });
    }
  } catch (err) {
    console.error('rate limit check failed:', err);
    return res.status(500).json({ error: 'Could not reach the database. Check your Upstash Redis setup.' });
  }

  const { username, password } = parseBody(req);
  if (!username || !password) {
    return res.status(401).json({ error: 'Incorrect name or password.' });
  }

  // The bootstrap Owner account always works off the env vars, so you can
  // never get locked out even if Redis or the admins list has issues.
  if (
    process.env.ADMIN_USER && process.env.ADMIN_PASS &&
    username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS
  ) {
    setSessionCookie(res, { username, permRole: 'owner' });
    return res.status(200).json({ ok: true });
  }

  try {
    const db = await readDb();
    const account = db.admins.find((a) => a.username === username);
    if (account && bcrypt.compareSync(password, account.passwordHash)) {
      setSessionCookie(res, { username: account.username, permRole: account.permRole });
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('login lookup error:', err);
    return res.status(500).json({ error: 'Could not reach the database.' });
  }

  return res.status(401).json({ error: 'Incorrect name or password.' });
}

function handleLogout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

function handleSession(req, res) {
  const session = getSession(req);
  res.status(200).json({
    isAdmin: !!session,
    username: session ? session.username : null,
    permRole: session ? session.permRole : null,
    capabilities: session ? capabilitiesFor(session.permRole) : []
  });
}

module.exports = async (req, res) => {
  const action = req.query.action;

  if (req.method === 'GET' && !action) return handleSession(req, res);
  if (req.method === 'POST' && action === 'login') return handleLogin(req, res);
  if (req.method === 'POST' && action === 'logout') return handleLogout(req, res);

  return res.status(405).json({ error: 'Method not allowed.' });
};
