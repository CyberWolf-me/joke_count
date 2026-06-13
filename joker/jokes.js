import { incrementUserJokeCount } from './redis.js';
import { generateJokeCountRoast } from './agent.js';

export async function buildJokeReply(chatId, targetUser, jokeText) {
  const count = await incrementUserJokeCount(chatId, targetUser.id);
  const displayName = formatUserName(targetUser);
  const fallbackReply = `${displayName} has ${count} counted ${pluralizeJoke(count)}.`;

  try {
    const roast = await generateJokeCountRoast({ displayName, count, jokeText });

    if (roast) {
      return roast.includes(String(count)) ? roast : `${fallbackReply}\n${roast}`;
    }
  } catch (error) {
    console.error('Joke-count roast failed:', error.message);
    return fallbackReply;
  }

  return fallbackReply;
}

function formatUserName(user) {
  if (user.username) {
    return `@${user.username}`;
  }

  return user.first_name || 'this person';
}

function pluralizeJoke(count) {
  return count === 1 ? 'joke' : 'jokes';
}
