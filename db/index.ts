import { env } from 'cloudflare:workers';

export function getD1(): D1Database {
  if (!env.DB) throw new Error('D1 binding DB is unavailable.');
  return env.DB;
}

export function getOpenAIConfig() {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini-2026-03-17';
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  return { apiKey, model };
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
