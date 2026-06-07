// lib/claude.js
// Thin wrapper around the Anthropic API using the official @anthropic-ai/sdk.
// Handles: plain chat, JSON-mode, convenience wrappers.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 1024;

let _client = null;

/**
 * Lazily construct the Anthropic client so the module can be required
 * before env vars are loaded (e.g. in tests).
 */
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env variable is not set.');
  _client = new Anthropic({ apiKey });
  return _client;
}

// ─── Core call ───────────────────────────────────────────────────────────────

/**
 * callClaude({ system, messages, maxTokens, jsonMode })
 *
 * system    — string  — the system prompt
 * messages  — array   — [{ role: "user"|"assistant", content: string }]
 * maxTokens — number  — default 1024
 * jsonMode  — bool    — if true, parses response as JSON and returns the object
 *
 * Returns: string (text) | object (jsonMode) | throws on error
 */
async function callClaude({
  system,
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  jsonMode = false,
}) {
  const client = getClient();

  const data = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages,
    ...(system ? { system } : {}),
  });

  // Extract text from the content blocks
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!jsonMode) return text;

  // Strip accidental markdown fences before parsing
  const clean = text.replace(/```(?:json)?|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

/**
 * chat({ systemPrompt, history, newMessage })
 *
 * The main function for sending a user message.
 * Returns the assistant's reply as a string.
 */
async function chat({ systemPrompt, history = [], newMessage }) {
  const messages = [...history, { role: 'user', content: newMessage }];
  return callClaude({ system: systemPrompt, messages });
}

/**
 * jsonCall({ system, userPrompt, maxTokens })
 *
 * Fire a single prompt that must return JSON.
 * Returns parsed object or throws.
 */
async function jsonCall({ system, userPrompt, maxTokens = 1024 }) {
  return callClaude({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens,
    jsonMode: true,
  });
}

module.exports = { callClaude, chat, jsonCall, MODEL };
