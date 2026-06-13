import 'dotenv/config';

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  redisUrl: process.env.REDIS_URL,
  botUsername: normalizeUsername(process.env.BOT_USERNAME || 'joker_counterbot'),
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  aiTemperature: Number(process.env.AI_TEMPERATURE || 0.9),
  aiMaxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 150),
  rateLimitMs: Number(process.env.RATE_LIMIT_MS || 3000)
};

export function requireConfig() {
  const missing = [];

  if (!config.telegramBotToken) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }

  if (!config.openrouterApiKey) {
    missing.push('OPENROUTER_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function normalizeUsername(username) {
  return username.replace(/^@/, '').trim().toLowerCase();
}
