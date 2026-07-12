const { checkLoginRateLimit } = require('../_lib/db');
const { setSessionCookie, getClientIp } = require('../_lib/auth');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const ip = getClientIp(req);
    const withinLimit = await checkLoginRateLimit(ip);
    if (!withinLimit) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in a few minutes.' });
    }
  } catch (err) {
    console.error('rate limit check failed:', err);
    // If Redis itself is unreachable, fail closed on rate limiting but don't block login entirely —
    // surface a clear error instead so it's obvious the database isn't connected.
    return res.status(500).json({ error: 'Could not reach the database. Check your Upstash Redis setup.' });
  }

  const { username, password } = parseBody(req);

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return res.status(500).json({ error: 'Server is missing ADMIN_USER / ADMIN_PASS environment variables.' });
  }

  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    setSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Incorrect name or password.' });
};
