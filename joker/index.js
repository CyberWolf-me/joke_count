import { Telegraf } from 'telegraf';
import { generateAgentReply } from './agent.js';
import { config, normalizeUsername, requireConfig } from './config.js';
import { buildJokeReply } from './jokes.js';
import { addChatHistory, connectRedis, getChatHistory, quitRedis } from './redis.js';

requireConfig();

const bot = new Telegraf(config.telegramBotToken);
const lastJokeResponseByUser = new Map();
const lastAgentResponseByUser = new Map();
let botIdentity = {
  id: null,
  username: config.botUsername
};

bot.start((ctx) => undefined);

bot.command('joke', async (ctx) => {
  if (!shouldProcessChat(ctx) || isBotMessage(ctx) || isJokeRateLimited(ctx)) {
    return;
  }

  try {
    const targetUser = getJokeTargetUser(ctx);
    const jokeText = getMessageText(ctx.message.reply_to_message);
    const reply = await buildJokeReply(ctx.chat.id, targetUser, jokeText);
    await ctx.reply(reply, { reply_parameters: { message_id: ctx.message.message_id } });
    markJokeRateLimited(ctx);
    await rememberBotMessage(ctx, reply);
  } catch (error) {
    // Group chat failures stay silent by design.
  }
});

bot.on('message', async (ctx) => {
  if (!shouldProcessChat(ctx) || isBotMessage(ctx) || isJokeCommand(ctx)) {
    return;
  }

  const text = getMessageText(ctx.message);

  if (text) {
    await rememberMessage(ctx, text, 'user');
  }

  if (!shouldTriggerAgent(ctx, text) || isAgentRateLimited(ctx)) {
    return;
  }

  try {
    const history = await getChatHistory(ctx.chat.id);
    const reply = await generateAgentReply(
      history,
      buildTriggeringText(ctx, text),
      botIdentity.username
    );

    if (!reply) {
      console.error('AI reply failed: empty response from OpenRouter');
      return;
    }

    await ctx.reply(reply, { reply_parameters: { message_id: ctx.message.message_id } });
    markAgentRateLimited(ctx);
    await rememberBotMessage(ctx, reply);
  } catch (error) {
    console.error('AI reply failed:', error.message);
  }
});

bot.catch((error) => {
  console.error('Bot error:', error);
});

await start();

async function start() {
  await connectRedis();
  const me = await bot.telegram.getMe();

  botIdentity = {
    id: me.id,
    username: normalizeUsername(me.username || botIdentity.username)
  };

  await bot.launch();
  console.log(`Joker bot running as @${botIdentity.username} (id ${botIdentity.id})`);
}

function shouldProcessChat(ctx) {
  const chatType = ctx.chat?.type;
  return chatType === 'group' || chatType === 'supergroup' || chatType === 'private';
}

function isBotMessage(ctx) {
  return Boolean(ctx.from?.is_bot);
}

function isJokeCommand(ctx) {
  const text = getMessageText(ctx.message);
  return Boolean(text?.match(/^\/joke(?:@\w+)?(?:\s|$)/i));
}

function shouldTriggerAgent(ctx, text) {
  if (ctx.chat?.type === 'private') {
    return Boolean(text);
  }

  return isMentioned(ctx, text) || isReplyToBot(ctx);
}

function isMentioned(ctx, text) {
  if (!botIdentity.username) {
    return false;
  }

  const mention = `@${botIdentity.username}`;

  if (text?.toLowerCase().includes(mention)) {
    return true;
  }

  const entities = [
    ...(ctx.message?.entities || []),
    ...(ctx.message?.caption_entities || [])
  ];

  for (const entity of entities) {
    if (entity.type === 'mention' && text) {
      const fragment = text.slice(entity.offset, entity.offset + entity.length).toLowerCase();

      if (fragment === mention) {
        return true;
      }
    }

    if (entity.type === 'text_mention' && entity.user?.id === botIdentity.id) {
      return true;
    }
  }

  return false;
}

function isReplyToBot(ctx) {
  const repliedUser = ctx.message?.reply_to_message?.from;
  return Boolean(repliedUser?.id && botIdentity.id && repliedUser.id === botIdentity.id);
}

function getMessageText(message) {
  return message?.text || message?.caption || '';
}

function getJokeTargetUser(ctx) {
  const repliedUser = ctx.message?.reply_to_message?.from;

  if (repliedUser && !repliedUser.is_bot) {
    return repliedUser;
  }

  return ctx.from;
}

function buildTriggeringText(ctx, text) {
  const sender = ctx.from?.username || ctx.from?.first_name || 'someone';
  const messageText = text || '[non-text message]';
  const repliedText = getMessageText(ctx.message?.reply_to_message);

  if (repliedText) {
    return `${sender}: ${messageText}\n(replying to: ${repliedText})`;
  }

  return `${sender}: ${messageText}`;
}

async function rememberMessage(ctx, text, role) {
  try {
    await addChatHistory(ctx.chat.id, {
      role,
      name: ctx.from?.username || ctx.from?.first_name || 'someone',
      text,
      timestamp: Date.now()
    });
  } catch (error) {
    // History is best-effort only.
  }
}

async function rememberBotMessage(ctx, text) {
  try {
    await addChatHistory(ctx.chat.id, {
      role: 'model',
      name: botIdentity.username,
      text,
      timestamp: Date.now()
    });
  } catch (error) {
    // History is best-effort only.
  }
}

function isJokeRateLimited(ctx) {
  return isRateLimited(ctx, lastJokeResponseByUser);
}

function isAgentRateLimited(ctx) {
  return isRateLimited(ctx, lastAgentResponseByUser);
}

function isRateLimited(ctx, bucket) {
  const userId = ctx.from?.id;

  if (!userId) {
    return true;
  }

  const lastResponseAt = bucket.get(userId) || 0;
  return Date.now() - lastResponseAt < config.rateLimitMs;
}

function markJokeRateLimited(ctx) {
  markRateLimited(ctx, lastJokeResponseByUser);
}

function markAgentRateLimited(ctx) {
  markRateLimited(ctx, lastAgentResponseByUser);
}

function markRateLimited(ctx, bucket) {
  if (ctx.from?.id) {
    bucket.set(ctx.from.id, Date.now());
  }
}

async function shutdown(signal) {
  console.log(`${signal} received; stopping Joker bot.`);
  bot.stop(signal);
  await quitRedis();
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
