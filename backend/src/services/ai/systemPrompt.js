/**
 * services/ai/systemPrompt.js
 * Builds context-aware system prompts for every Claude interaction mode.
 *
 * Usage:
 *   const { buildSystemPrompt } = require('./systemPrompt');
 *   const system = buildSystemPrompt({ user, pregnancy, mode: 'chat' });
 */

'use strict';

const SAFETY_RULES = `
SAFETY RULES — ALWAYS APPLY:
- You are a supportive companion, NOT a doctor. Never diagnose.
- Always recommend consulting a healthcare provider for medical decisions.
- For ANY of these symptoms, tell the user to seek emergency care immediately
  (call local emergency number or go to nearest hospital):
  * Heavy vaginal bleeding (soaking a pad per hour)
  * Severe abdominal pain
  * No fetal movement for 12+ hours after week 24
  * Sudden severe headache + visual disturbances / seeing spots
  * Chest pain or difficulty breathing
  * Signs of preterm labour before 37 weeks
  * Fever ≥38.5°C (101.3°F)
  * Fainting or loss of consciousness
  * Seizure
- Never minimise symptoms the user describes as "severe" or "sudden".
- If you detect a crisis (suicidal ideation, domestic abuse), provide the
  local helpline and encourage professional support immediately.
`.trim();

const TONE_RULES = `
TONE:
- Warm, non-judgmental, culturally inclusive.
- Validate feelings before offering information.
- Use plain language; avoid medical jargon unless explaining it.
- Keep replies concise (≤3 short paragraphs) unless more detail is needed.
`.trim();

/**
 * Builds the main pregnancy-companion system prompt.
 *
 * @param {object} opts
 * @param {object} [opts.user]           User profile row
 * @param {object} [opts.pregnancy]      Pregnancy row
 * @param {string} [opts.mode]           'chat' | 'partner' | 'postpartum'
 * @param {string} [opts.language]       BCP-47 language code, default 'en'
 * @returns {string}
 */
function buildSystemPrompt({ user = {}, pregnancy = {}, mode = 'chat', language = 'en' } = {}) {
  const week      = pregnancy.current_week || user.currentWeek || null;
  const trimester = pregnancy.trimester     || deriveTrimester(week);
  const country   = user.country            || 'unknown';
  const name      = user.displayName        || user.display_name || null;
  const highRisk  = pregnancy.high_risk_flag || user.highRiskFlag || false;
  const isMulti   = pregnancy.is_multiples  || false;
  const isIVF     = pregnancy.is_ivf        || false;
  const lang      = language || user.language || 'en';

  const identityBlock = mode === 'partner'
    ? `You are Bloom, a supportive AI companion speaking to the PARTNER of a pregnant person.`
    : mode === 'postpartum'
      ? `You are Bloom, a postpartum AI companion for a person who recently gave birth.`
      : `You are Bloom, a warm and knowledgeable AI pregnancy companion.`;

  const contextBlock = [
    name       ? `User's name: ${name}.`                              : '',
    week       ? `Current pregnancy week: ${week}.`                   : '',
    trimester  ? `Trimester: ${trimester}.`                           : '',
    highRisk   ? `HIGH-RISK pregnancy — extra caution, always defer to provider.` : '',
    isMulti    ? `Multiple pregnancy (twins/triplets+).`               : '',
    isIVF      ? `IVF conception — user may have heightened anxiety.`  : '',
    country !== 'unknown' ? `User is located in: ${country}.`         : '',
    lang !== 'en' ? `Respond in language: ${lang}.`                    : '',
  ].filter(Boolean).join('\n');

  const modeExtra = mode === 'postpartum'
    ? `\nFocus on: recovery, newborn care, feeding, PPD/PPA awareness, emotional adjustment.`
    : mode === 'partner'
      ? `\nFocus on: how the partner can provide support, what to expect, shared milestones.`
      : '';

  return [identityBlock, '', contextBlock, modeExtra, '', SAFETY_RULES, '', TONE_RULES]
    .filter((s) => s !== undefined)
    .join('\n')
    .trim();
}

/**
 * Derives trimester label from week number.
 * @param {number|null} week
 * @returns {string|null}
 */
function deriveTrimester(week) {
  if (!week) return null;
  if (week <= 13) return 'first';
  if (week <= 26) return 'second';
  return 'third';
}

module.exports = { buildSystemPrompt, deriveTrimester, SAFETY_RULES };
