# Joker Telegram Bot

Telegram group bot with two independent features:

- `/joke` increments a user's joke count in Redis. If `/joke` is used as a reply, it counts the author of the replied-to message.
- Mentions/replies to the bot call OpenRouter with recent group context and the Joker personality prompt.

## Local Development

1. Install Node.js 18 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` from `.env.example` and fill in:

   ```env
   TELEGRAM_BOT_TOKEN=
   OPENROUTER_API_KEY=
   OPENROUTER_MODEL=openai/gpt-4o-mini
   REDIS_URL=redis://localhost:6380
   BOT_USERNAME=joker_huhbot
   ```

4. Start Redis locally:

   ```bash
   docker compose up -d redis
   ```

5. Start the bot:

   ```bash
   npm start
   ```

## Deploy Online (Always Running)

The bot uses Telegram **polling**, so it needs one always-on process. Do **not** run `npm start` locally and in the cloud at the same time — Telegram will return a `409 Conflict` error.

### Option A: Railway (easiest, no server to manage)

1. Push this repo to GitHub (keep `.env` out of git).
2. Go to [railway.app](https://railway.app) and create a new project.
3. Add a **Redis** service (Railway template or Upstash).
4. Add a **service from GitHub repo** for the bot.
5. In the bot service, set these variables:

   ```env
   TELEGRAM_BOT_TOKEN=
   OPENROUTER_API_KEY=
   OPENROUTER_MODEL=openai/gpt-4o-mini
   BOT_USERNAME=joker_huhbot
   REDIS_URL=<paste redis connection url>
   ```

   For Railway Redis in the same project, use the internal URL (e.g. `redis://default:password@redis.railway.internal:6379`).

6. Deploy. Railway builds from the `Dockerfile` and restarts the bot if it crashes.
7. Stop local `npm start` if it is still running.

Check logs in the Railway dashboard. You should see:

```text
Joker bot running as @joker_huhbot (id ...)
```

### Option B: VPS + Docker (cheapest long-term)

Use any small Linux VPS (Hetzner, DigitalOcean, Oracle free tier, etc.) with Docker installed.

1. Copy the project to the server (git clone or scp).
2. Create `.env` on the server with your secrets.
3. Start bot + Redis together:

   ```bash
   npm run docker:prod
   ```

   Or:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. View logs:

   ```bash
   npm run docker:prod:logs
   ```

5. Stop local `npm start` on your PC.

Both containers use `restart: unless-stopped`, so they come back after reboot or crashes.

To update after code changes:

```bash
git pull
npm run docker:prod
```

## Behavior

- Works in group/supergroup chats and direct messages with the bot.
- Ignores bot messages and its own messages.
- Never sends unsolicited replies in groups.
- `/joke` uses AI for a roast reply and stores counts under `joke_count:{chat_id}:{user_id}`.
- AI replies when the bot is mentioned, someone replies to a bot message, or in DMs.
- Redis failures are swallowed: joke counts use an in-memory fallback, and history is skipped.
- Per-user response rate limit is 1 bot response every 3 seconds (separate limits for `/joke` and AI chat).
