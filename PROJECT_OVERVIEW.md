# Joker Telegram Bot Project Overview

## Purpose

Joker is a Telegram group bot focused on two behaviors:

1. Count jokes per user when someone uses `/joke`.
2. Reply in character when mentioned or replied to, using OpenRouter.

The joke counter and the AI chat behavior are separate flows. The counter works through Redis. The AI personality works through Markdown prompts in `joker/prompts`.

## Runtime Stack

- Node.js 18+
- Telegraf for Telegram bot events
- Redis for persistent joke counts and optional chat history
- OpenRouter for AI responses
- Docker Compose for local Redis

## Main Files

- `joker/index.js` - Telegram bot entry point, command handlers, mention/reply triggers, rate limiting.
- `joker/jokes.js` - `/joke` counter reply logic and AI roast fallback handling.
- `joker/agent.js` - OpenRouter client and prompt loading.
- `joker/redis.js` - Redis connection, joke count storage, and chat history helpers.
- `joker/config.js` - Environment variable loading and validation.
- `joker/prompts/joker_agent.md` - Main personality prompt for mentions/replies.
- `joker/prompts/joke_count_roast.md` - Prompt for sarcastic `/joke` counter replies.
- `docker-compose.yml` - Local Redis container setup.

## Environment Variables

Required:

```env
TELEGRAM_BOT_TOKEN=
OPENROUTER_API_KEY=
REDIS_URL=redis://localhost:6380
BOT_USERNAME=joker_counterbot
```

Optional:

```env
OPENROUTER_MODEL=openai/gpt-4o-mini
AI_TEMPERATURE=0.9
AI_MAX_OUTPUT_TOKENS=150
RATE_LIMIT_MS=3000
```

## Bot Behavior

### `/joke`

When a user sends `/joke` in a group:

- If `/joke` is a reply to another user's message, that replied-to user gets `+1`.
- If `/joke` is not a reply, the sender gets `+1`.
- Bot ignores bot users as joke targets.
- Count is stored under `joke_count:{chat_id}:{user_id}`.
- Bot tries to generate a sarcastic count reply through OpenRouter.
- If OpenRouter fails, bot falls back to a plain count like:

```text
@username has 7 counted jokes.
```

### AI Agent

The AI agent replies only when:

- Someone mentions the bot username, for example `@joker_counterbot`.
- Someone replies to a message sent by the bot.

It does not reply to:

- Normal group messages without mention/reply.
- `/joke` commands.
- Direct messages.
- Bot messages.
- Its own messages.

## Redis Keys

```text
joke_count:{chat_id}:{user_id}
chat_history:{chat_id}
```

`joke_count:{chat_id}:{user_id}` is an integer counter.

`chat_history:{chat_id}` is a Redis list storing the last 10 chat messages for AI context.

If Redis is unavailable:

- Joke counts use an in-memory fallback.
- Chat history is skipped.
- In-memory counts reset when the bot restarts.

## Local Development

Install dependencies:

```bash
npm install
```

Start Redis:

```bash
docker compose up -d redis
```

Run syntax checks:

```bash
npm run check
```

Start the bot:

```bash
npm start
```

## Prompt Editing

Edit these files for bot tone:

- `joker/prompts/joker_agent.md` for mention/reply chat behavior.
- `joker/prompts/joke_count_roast.md` for `/joke` counter roast behavior.

Restart the bot after editing prompts. Prompt text is cached while the process is running.

## Notes

- The local Redis container maps host port `6380` to container port `6379`.
- The bot logs AI failures in the terminal but avoids sending internal errors into the group chat.
- Per-user response rate limit defaults to one response every 3 seconds.
