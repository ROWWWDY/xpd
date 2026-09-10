const jwt = require('jsonwebtoken');
const { parse, serialize } = require('cookie');
const { can } = require('./permissions');

const COOKIE_NAME = 'xpd_session';
const SESSION_HOURS = 4;

function getSecret() {
  return process.env.JWT_SECRET || 'insecure-dev-secret-change-me';
}

function isProd() {
  return !!process.env.VERCEL;
}

// Returns the session payload ({ type, username, permRole }) or null.
function getSession(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSecret());
    if (!payload || payload.type !== 'admin') return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// True for any logged-in admin, regardless of role (owner or reviewer).
function verifyRequest(req) {
  return !!getSession(req);
}

// True only for the Owner role — used to gate admin-account management,
// which no other role should ever be able to touch.
function requireOwner(req) {
  const session = getSession(req);
  return !!session && session.permRole === 'owner';
}

// The general-purpose check — does this session's role include a given
// capability? See _lib/permissions.js for the role → capability list.
function hasCapability(req, capability) {
  const session = getSession(req);
  return !!session && can(session.permRole, capability);
}

function setSessionCookie(res, { username, permRole }) {
  const token = jwt.sign(
    { type: 'admin', username, permRole },
    getSecret(),
    { expiresIn: SESSION_HOURS + 'h' }
  );
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 60 * 60
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
  );
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

module.exports = {
  verifyRequest,
  requireOwner,
  hasCapability,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  getClientIp
};
