import "server-only";

import OpenAI from "openai";

console.log("ENV CHECK:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("OPENAI_MODEL:", process.env.OPENAI_MODEL);

let cachedClient: OpenAI | null = null;

/**
 * Returns the model used for all LLM calls.
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.2";
}

/**
 * Creates and caches a server-side OpenAI client from environment variables.
 * Throws when `OPENAI_API_KEY` is missing.
 */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    });
  }

  return cachedClient;
}
