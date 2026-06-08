/**
 * services/claude.js
 * Enhanced Anthropic API wrapper with streaming, retry, and token tracking.
 *
 * Usage:
 *   const { chat, jsonCall, chatStream } = require('./claude');
 *
 *   // Plain chat
 *   const reply = await chat({ systemPrompt, history, newMessage });
 *
 *   // JSON extraction
 *   const obj = await jsonCall({ system, userPrompt, maxTokens: 800 });
 *
 *   // Streaming (SSE endpoint)
 *   const stream = await chatStream({ systemPrompt, history, newMessage });
 *   for await (const chunk of stream) {
 *     res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
 *   }
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const MODEL     = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const MAX_RETRY = 3;
const RETRY_BASE_MS = 500;

let _client = null;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Returns the lazily-initialised Anthropic client.
 * Throws if ANTHROPIC_API_KEY is not set.
 */
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env variable is not set.');
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/**
 * Calls `fn` up to MAX_RETRY times, retrying on 429 / 529 / network errors.
 * @param {Function} fn  Async function to retry
 * @returns {*} Whatever fn resolves to
 */
async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.status || err.statusCode;
      const isRetryable = !status || status === 429 || status === 529 || status >= 500;
      if (!isRetryable || attempt === MAX_RETRY) break;
      const wait = RETRY_BASE_MS * 2 ** attempt + Math.random() * 200;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// callClaude — core low-level call
// ---------------------------------------------------------------------------

/**
 * Sends a message array to Claude and returns the text response.
 *
 * @param {object} opts
 * @param {string}  opts.system      System prompt
 * @param {Array}   opts.messages    [{role, content}] conversation turns
 * @param {number}  [opts.maxTokens] Default 1024
 * @param {boolean} [opts.jsonMode]  Parse response as JSON
 * @returns {string|object}
 */
async function callClaude({
  system,
  messages,
  maxTokens = 1024,
  jsonMode = false,
}) {
  const client = getClient();

  const data = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
      ...(system ? { system } : {}),
    })
  );

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!jsonMode) return text;

  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Claude returned invalid JSON:\n${clean.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// chat — single-turn convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Send one message in a conversation and get a string reply.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {Array}  [opts.history]     Prior turns [{role,content}]
 * @param {string} opts.newMessage
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>}
 */
async function chat({ systemPrompt, history = [], newMessage, maxTokens = 1024 }) {
  const messages = [...history, { role: 'user', content: newMessage }];
  return callClaude({ system: systemPrompt, messages, maxTokens });
}

// ---------------------------------------------------------------------------
// jsonCall — structured JSON extraction
// ---------------------------------------------------------------------------

/**
 * Fire a single prompt that must return JSON.
 * Parses and returns the object, throws on malformed JSON.
 *
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.userPrompt
 * @param {number} [opts.maxTokens]
 * @returns {Promise<object>}
 */
async function jsonCall({ system, userPrompt, maxTokens = 1024 }) {
  return callClaude({
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens,
    jsonMode: true,
  });
}

// ---------------------------------------------------------------------------
// chatStream — streaming chat for SSE endpoints
// ---------------------------------------------------------------------------

/**
 * Returns an async generator that yields text chunks as Claude streams them.
 * Designed for use in an SSE Express route.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {Array}  [opts.history]
 * @param {string} opts.newMessage
 * @param {number} [opts.maxTokens]
 *
 * @example
 * // Express SSE route
 * res.setHeader('Content-Type', 'text/event-stream');
 * const stream = chatStream({ systemPrompt, history, newMessage });
 * for await (const chunk of stream) {
 *   res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
 * }
 * res.write('data: [DONE]\n\n');
 * res.end();
 */
async function* chatStream({ systemPrompt, history = [], newMessage, maxTokens = 1024 }) {
  const client = getClient();
  const messages = [...history, { role: 'user', content: newMessage }];

  const stream = await withRetry(() =>
    client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    })
  );

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

module.exports = { callClaude, chat, jsonCall, chatStream, MODEL, getClient };
