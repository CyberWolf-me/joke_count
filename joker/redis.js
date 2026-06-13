import Redis from 'ioredis';
import { config } from './config.js';

const redis = config.redisUrl ? new Redis(config.redisUrl, { lazyConnect: true }) : null;
const fallbackJokeCounts = new Map();

if (redis) {
  redis.on('error', () => {
    // Redis is optional at runtime; helpers degrade silently.
  });
}

export async function connectRedis() {
  if (!redis) {
    return;
  }

  try {
    await redis.connect();
  } catch (error) {
    console.error('Redis unavailable; continuing without persistence.');
  }
}

export async function incrementUserJokeCount(chatId, userId) {
  const key = `joke_count:${chatId}:${userId}`;

  if (!redis || redis.status !== 'ready') {
    return incrementFallbackJokeCount(key);
  }

  try {
    return await redis.incr(key);
  } catch (error) {
    return incrementFallbackJokeCount(key);
  }
}

export async function addChatHistory(chatId, entry) {
  if (!redis || redis.status !== 'ready') {
    return;
  }

  try {
    const key = `chat_history:${chatId}`;
    await redis.lpush(key, JSON.stringify(entry));
    await redis.ltrim(key, 0, 9);
  } catch (error) {
    // History is best-effort only.
  }
}

export async function getChatHistory(chatId) {
  if (!redis || redis.status !== 'ready') {
    return [];
  }

  try {
    const items = await redis.lrange(`chat_history:${chatId}`, 0, 9);
    return items.reverse().map((item) => JSON.parse(item));
  } catch (error) {
    return [];
  }
}

export async function quitRedis() {
  if (redis) {
    await redis.quit();
  }
}

function incrementFallbackJokeCount(key) {
  const nextCount = (fallbackJokeCounts.get(key) || 0) + 1;
  fallbackJokeCounts.set(key, nextCount);
  return nextCount;
}
