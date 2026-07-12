const jwt = require('jsonwebtoken');
const { parse, serialize } = require('cookie');

const COOKIE_NAME = 'xpd_session';
const SESSION_HOURS = 4;

function getSecret() {
  return process.env.JWT_SECRET || 'insecure-dev-secret-change-me';
}

function isProd() {
  return !!process.env.VERCEL;
}

function verifyRequest(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, getSecret());
    return payload && payload.role === 'admin';
  } catch (e) {
    return false;
  }
}

function setSessionCookie(res) {
  const token = jwt.sign({ role: 'admin' }, getSecret(), { expiresIn: SESSION_HOURS + 'h' });
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

module.exports = { verifyRequest, setSessionCookie, clearSessionCookie, getClientIp };
