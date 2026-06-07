// services/session.js
// The main chat loop — call sendMessage() for every user message.
// Handles: system prompt injection, history management, safety routing.

const { chat } = require('../lib/claude');
const { buildSystemPrompt } = require('../prompts/systemPrompt');

// ── Safety keywords that auto-trigger emergency response ──────────────────────
// (Belt-and-suspenders — the system prompt also instructs Claude to catch these)
const EMERGENCY_KEYWORDS = [
  'not moving', 'no movement', 'bleeding heavily', 'soaking',
  'chest pain', "can't breathe", 'severe pain', 'passed out',
  'fainted', 'blurred vision', 'seeing spots', 'water broke',
  'preterm', 'miscarriage', 'seizure',
];

const EMERGENCY_RESPONSE =
  'Please seek emergency care immediately. ' +
  'Call your local emergency number (e.g. 911, 999, 112) or go to the nearest hospital.';

// Max turns to keep in context window (older turns are dropped)
const MAX_HISTORY_TURNS = 20;

/**
 * sendMessage({ userProfile, message, history }) → { reply, updatedHistory, emergency }
 *
 * userProfile — profile loaded from your DB (see runOnboarding output)
 * message     — the user's raw text input
 * history     — prior conversation turns [{ role, content }]
 */
async function sendMessage({ userProfile, message, history = [] }) {
  // 1. Hard safety check before touching the API
  if (containsEmergencyKeyword(message)) {
    console.warn('[session] Emergency keyword detected — short-circuiting to safety response.');
    return {
      reply: EMERGENCY_RESPONSE,
      updatedHistory: [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: EMERGENCY_RESPONSE },
      ],
      emergency: true,
    };
  }

  // 2. Build the system prompt with current user state
  const systemPrompt = buildSystemPrompt(userProfile);

  // 3. Trim history to stay within context budget
  const trimmed = trimHistory(history);

  // 4. Call the API
  const reply = await chat({ systemPrompt, history: trimmed, newMessage: message });

  // 5. Append this turn to history
  const updatedHistory = [
    ...trimmed,
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ];

  return { reply, updatedHistory, emergency: false };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function containsEmergencyKeyword(text) {
  const lower = (text || '').toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

function trimHistory(history) {
  const maxMessages = MAX_HISTORY_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
}

module.exports = { sendMessage, containsEmergencyKeyword, EMERGENCY_RESPONSE };
