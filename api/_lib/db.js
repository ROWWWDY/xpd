const { Redis } = require('@upstash/redis');

const DB_KEY = 'xpd:db';

let client = null;
function getRedis() {
  if (!client) {
    // Vercel's Upstash Marketplace integration uses UPSTASH_REDIS_REST_URL/TOKEN.
    // Older "Vercel KV" style projects use KV_REST_API_URL/TOKEN instead.
    // Check both explicitly rather than relying on Redis.fromEnv() to guess.
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Redis credentials not found. Expected UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN ' +
        'or KV_REST_API_URL/KV_REST_API_TOKEN in environment variables.'
      );
    }

    client = new Redis({ url, token });
  }
  return client;
}

async function readDb() {
  const redis = getRedis();
  const data = await redis.get(DB_KEY);
  if (!data) {
    return { counter: 200, applications: [], config: { sheetWebhookUrl: '' }, invites: [] };
  }
  // The SDK may hand back a parsed object or a raw string depending on how
  // it was stored — handle both so this never breaks on a format change.
  let db;
  if (typeof data === 'string') {
    try {
      db = JSON.parse(data);
    } catch (e) {
      db = { counter: 200, applications: [], config: { sheetWebhookUrl: '' }, invites: [] };
    }
  } else {
    db = data;
  }
  // Backfill invites for databases written before this feature existed.
  if (!Array.isArray(db.invites)) db.invites = [];
  return db;
}

async function writeDb(db) {
  const redis = getRedis();
  await redis.set(DB_KEY, JSON.stringify(db));
}

async function checkLoginRateLimit(ip) {
  const redis = getRedis();
  const key = `xpd:loginattempts:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 15 * 60); // 15 minute window
  }
  return count <= 10;
}

module.exports = { readDb, writeDb, checkLoginRateLimit, getRedis };
