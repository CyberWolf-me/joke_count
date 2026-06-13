import { readFile } from 'node:fs/promises';
import { config } from './config.js';

const promptPath = new URL('./prompts/joker_agent.md', import.meta.url);
const jokeCountPromptPath = new URL('./prompts/joke_count_roast.md', import.meta.url);

let cachedSystemPrompt;
let cachedJokeCountPrompt;

export async function generateAgentReply(history, triggeringText, botUsername) {
  const systemPrompt = await getSystemPrompt();
  const messages = buildMessages(systemPrompt, history, triggeringText);
  const reply = await generateOpenRouterText(messages, config.aiMaxOutputTokens);
  return sanitizeAgentReply(reply, botUsername);
}

export function sanitizeAgentReply(reply, botUsername) {
  if (!reply) {
    return reply;
  }

  let cleaned = reply.trim();

  if (botUsername) {
    cleaned = cleaned.replace(new RegExp(`^@?${escapeRegExp(botUsername)}\\s*:\\s*`, 'i'), '');
  }

  cleaned = cleaned.replace(/^(joke_counterbot|joker_counterbot|joker_huhbot)\s*:\s*/i, '');
  return cleaned.trim();
}

export async function generateJokeCountRoast({ displayName, count, jokeText }) {
  const systemPrompt = await getJokeCountPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `User: ${displayName}`,
        `Counted jokes: ${count}`,
        `Joke text: ${jokeText || '[not provided]'}`
      ].join('\n')
    }
  ];

  return generateOpenRouterText(messages, 80);
}

async function generateOpenRouterText(messages, maxOutputTokens) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost/joker-telegram-bot',
      'X-Title': 'Joker Telegram Bot'
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages,
      temperature: config.aiTemperature,
      max_tokens: maxOutputTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed with ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

function buildMessages(systemPrompt, history, triggeringText) {
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const message of history) {
    messages.push({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: formatHistoryMessage(message)
    });
  }

  messages.push({
    role: 'user',
    content: triggeringText
  });

  return messages;
}

function formatHistoryMessage(message) {
  if (message.role === 'model') {
    return message.text;
  }

  const name = message.name ? `${message.name}: ` : '';
  return `${name}${message.text}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = await readFile(promptPath, 'utf8');
  }

  return cachedSystemPrompt;
}

async function getJokeCountPrompt() {
  if (!cachedJokeCountPrompt) {
    cachedJokeCountPrompt = await readFile(jokeCountPromptPath, 'utf8');
  }

  return cachedJokeCountPrompt;
}
