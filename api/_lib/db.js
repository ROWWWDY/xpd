const { Redis } = require('@upstash/redis');

const DB_KEY = 'xpd:db';

let client = null;
function getRedis() {
  if (!client) {
    // Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or the legacy
    // KV_REST_API_URL / KV_REST_API_TOKEN names) from environment variables.
    client = Redis.fromEnv();
  }
  return client;
}

async function readDb() {
  const redis = getRedis();
  const data = await redis.get(DB_KEY);
  if (!data) {
    return { counter: 200, applications: [], config: { sheetWebhookUrl: '' } };
  }
  // The SDK may hand back a parsed object or a raw string depending on how
  // it was stored — handle both so this never breaks on a format change.
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return { counter: 200, applications: [], config: { sheetWebhookUrl: '' } };
    }
  }
  return data;
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
