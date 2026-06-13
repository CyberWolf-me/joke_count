PROJECT: Joker — Telegram Group Bot
STORAGE: Redis
TRIGGER: /joke command + tag/reply to bot

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A Telegram group bot with two distinct features:

1. /joke command → tells a joke, tracks joke count per group via Redis
2. AI Agent (Gemini) → responds only when tagged (@joker_counterbot) or when 
   someone replies to one of Joker's messages. Acts like a slow, 
   confused, funny-but-not-really guy.

The two features are INDEPENDENT. The AI agent knows nothing about 
jokes. The joke counter knows nothing about the AI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FEATURE 1 — /joke COMMAND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: User sends /joke in a group

BEHAVIOR:
- Bot replies with a short, original, bad joke in Joker's voice
- After the joke, always append: "📊 Joke #{count} delivered. quality not guaranteed."
- Jokes are hardcoded OR pulled from a predefined list (no AI for this)

REDIS SCHEMA:
- Key: "joke_count:{chat_id}"
- Type: integer
- Action: INCR on every /joke call
- No expiry (persistent forever)

MILESTONE RESPONSES (append to normal joke reply):
- Every 5th joke  → "wow that's {count} jokes... i should be on TV"
- Every 10th joke → "10 jokes... am i actually funny or is everyone 
                     just being nice... 🤔 anyway here's another one"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FEATURE 2 — AI AGENT (GEMINI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER:
- Someone @mentions the bot in a group message
- Someone replies to a message previously sent by the bot

DO NOT trigger on:
- Regular group messages with no mention or reply to bot
- /joke command messages
- Bot's own messages

CONTEXT TO SEND TO GEMINI:
- System prompt: [the Joker personality prompt]
- Last 10 messages from the group chat as conversation history
- The triggering message as the final user turn

REDIS SCHEMA (optional, for chat history):
- Key: "chat_history:{chat_id}"
- Type: list (LPUSH, LTRIM to keep last 10)
- Each entry: JSON with {role, name, text, timestamp}
- No expiry (or set TTL to 24h if you want it to reset daily)

GEMINI CALL STRUCTURE:
- Model: gemini-2.0-flash (or latest available)
- System instruction: Joker personality prompt
- Contents: last 10 messages → triggering message
- Temperature: 0.9 (keep it loose and unpredictable)
- Max output tokens: 150 (Joker doesn't write essays)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REDIS KEYS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

joke_count:{chat_id}         → integer, joke counter per group
chat_history:{chat_id}       → list, last 10 messages per group

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## GENERAL BOT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Bot only operates in GROUP chats (ignore DMs or handle separately)
- Bot never sends unsolicited messages
- Bot never replies to itself
- Bot never replies to other bots
- All errors fail silently (no error messages in group chat)
- All Redis operations wrapped in try/catch — if Redis is down, 
  joke count defaults to "??" and chat history is skipped
- Rate limit: max 1 response per user per 3 seconds to avoid spam

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FOLDER STRUCTURE (suggested)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/joker
  index.{js/py}         → bot entry point, command/event listeners
  agent.{js/py}         → Gemini API call logic
  jokes.{js/py}         → joke list + formatter
  redis.{js/py}         → Redis client + helper functions
  config.{js/py}        → env vars (BOT_TOKEN, GEMINI_KEY, REDIS_URL)
  prompts/
    joker_agent.txt    → Joker personality system prompt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TELEGRAM_BOT_TOKEN=
GEMINI_API_KEY=
REDIS_URL=