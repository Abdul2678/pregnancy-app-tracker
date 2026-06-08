#!/usr/bin/env node
/**
 * scripts/generateWeeklyContent.js
 *
 * Pre-generates all 40 weeks of pregnancy development content via Claude
 * and stores it in the pregnancy_weeks_cache table.
 *
 * Safe to re-run: skips weeks already present (--force flag overwrites).
 *
 * Usage:
 *   node scripts/generateWeeklyContent.js
 *   node scripts/generateWeeklyContent.js --track high_risk --language es
 *   node scripts/generateWeeklyContent.js --weeks 20-25 --force
 *   node scripts/generateWeeklyContent.js --dry-run
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const db      = require('../src/db');
const { jsonCall } = require('../src/lib/claude');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

function flag(name)       { return argv.includes(`--${name}`); }
function opt(name, def)   {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}

const TRACK    = opt('track',    'standard');
const LANGUAGE = opt('language', 'en');
const PHASE    = opt('phase',    'pregnancy');
const DELAY_MS = parseInt(opt('delay', '1000'), 10);
const DRY_RUN  = flag('dry-run');
const FORCE    = flag('force');

// --weeks 20-25  or  --weeks 12
const WEEKS_OPT = opt('weeks', '1-40');
const [FROM_W, TO_W] = WEEKS_OPT.includes('-')
  ? WEEKS_OPT.split('-').map(Number)
  : [Number(WEEKS_OPT), Number(WEEKS_OPT)];

const WEEKS = Array.from({ length: TO_W - FROM_W + 1 }, (_, i) => FROM_W + i)
  .filter((w) => w >= 1 && w <= 42);

// ---------------------------------------------------------------------------
// Claude prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Bloom's pregnancy content specialist.
Generate accurate, warm, evidence-based development content aligned with
WHO, ACOG, and NHS guidance. Use plain language.
Respond in language code: ${LANGUAGE}.
Return ONLY valid JSON — no markdown fences, no preamble, no trailing text.`;

/**
 * Returns the JSON structure Claude must fill in for one pregnancy week.
 * Field names mirror the pregnancy_weeks_cache columns exactly.
 */
function buildWeekPrompt(week) {
  const trimester = week <= 13 ? 1 : week <= 26 ? 2 : 3;

  return `Generate complete development content for pregnancy week ${week} (trimester ${trimester}).
Track: ${TRACK}. Language: ${LANGUAGE}.

Return EXACTLY this JSON structure — every field is required:

{
  "week": ${week},
  "trimester": ${trimester},

  "babySizeDescription": "one evocative sentence comparing baby to a familiar object/fruit",
  "babySizeFruitComparison": "single fruit or vegetable name only, e.g. 'avocado'",
  "babySizeFunComparison": "fun non-food object comparison, e.g. 'a TV remote'",
  "babySizeCm": <number — crown-to-rump length in cm, e.g. 14.2>,
  "babySizeInches": <number — same length in inches>,
  "babyWeightGrams": <number — approximate weight in grams>,
  "babyWeightOz": <number — same weight in ounces>,

  "headlineSentence": "one exciting sentence about the biggest development this week",

  "developmentHighlights": [
    { "system": "organ system name", "detail": "what is forming or maturing" },
    { "system": "...", "detail": "..." },
    { "system": "...", "detail": "..." }
  ],

  "organSystemsForming": ["list of organ systems actively developing this week"],

  "momBodyChanges": [
    "physical change 1",
    "physical change 2",
    "physical change 3"
  ],

  "emotionalChanges": "2-3 sentence description of emotional landscape this week",

  "commonSymptoms": [
    { "name": "symptom name", "description": "brief explanation", "tip": "one actionable relief tip" },
    { "name": "...", "description": "...", "tip": "..." },
    { "name": "...", "description": "...", "tip": "..." },
    { "name": "...", "description": "...", "tip": "..." },
    { "name": "...", "description": "...", "tip": "..." }
  ],

  "nutritionTips": [
    { "tip": "actionable nutrition advice", "why": "brief reason" },
    { "tip": "...", "why": "..." },
    { "tip": "...", "why": "..." }
  ],

  "exerciseGuidance": "2 sentences on safe movement and exercise this week",

  "thingsToAvoid": [
    { "item": "thing to avoid", "reason": "brief reason" }
  ],

  "appointmentsThisWeek": [
    { "type": "appointment_type", "description": "what to expect", "isRoutine": true }
  ],

  "screeningTests": [
    { "name": "test name", "timing": "when offered", "description": "what it checks" }
  ],

  "weeklyChecklist": [
    { "item": "actionable to-do", "category": "health" },
    { "item": "...", "category": "nutrition" },
    { "item": "...", "category": "preparation" }
  ],

  "weeklyTip": {
    "nutrition": "one specific nutrition tip for this exact week",
    "movement": "one specific movement/exercise tip",
    "sleep": "one specific sleep tip",
    "partner": "one tip for the partner/support person"
  },

  "questionsToAskDoctor": [
    "question 1 appropriate for this gestational week",
    "question 2",
    "question 3"
  ],

  "partnerTip": "one warm, specific tip for the partner or support person this week",
  "affirmation": "one short, sincere affirmation for the pregnant person",
  "didYouKnow": "one surprising, delightful fetal development fact for week ${week}",

  "sources": ["WHO", "ACOG", "NHS"]
}`;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of weeks already in the DB for this track/language/phase.
 * @returns {Promise<Set<number>>}
 */
async function fetchExistingWeeks() {
  const { rows } = await db.query(
    `SELECT week FROM pregnancy_weeks_cache
     WHERE phase = $1 AND track = $2 AND language = $3`,
    [PHASE, TRACK, LANGUAGE]
  );
  return new Set(rows.map((r) => r.week));
}

/**
 * Upserts one week's content into pregnancy_weeks_cache.
 * Maps the Claude JSON fields to the exact DB columns.
 * @param {number} week
 * @param {object} c  Claude JSON result
 */
async function upsertWeek(week, c) {
  await db.query(
    `INSERT INTO pregnancy_weeks_cache (
       week, phase, track, language,
       baby_size_description,
       baby_size_cm, baby_weight_grams,
       development_highlights,
       organ_systems_forming,
       common_symptoms,
       body_changes,
       emotional_changes,
       nutrition_tips,
       exercise_guidance,
       things_to_avoid,
       appointments_this_week,
       screening_tests,
       checklist,
       partner_tip,
       affirmation,
       did_you_know,
       sources,
       is_stub,
       generated_at
     ) VALUES (
       $1,$2,$3,$4,
       $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
       FALSE, now()
     )
     ON CONFLICT (week, phase, track, language)
     DO UPDATE SET
       baby_size_description  = EXCLUDED.baby_size_description,
       baby_size_cm           = EXCLUDED.baby_size_cm,
       baby_weight_grams      = EXCLUDED.baby_weight_grams,
       development_highlights = EXCLUDED.development_highlights,
       organ_systems_forming  = EXCLUDED.organ_systems_forming,
       common_symptoms        = EXCLUDED.common_symptoms,
       body_changes           = EXCLUDED.body_changes,
       emotional_changes      = EXCLUDED.emotional_changes,
       nutrition_tips         = EXCLUDED.nutrition_tips,
       exercise_guidance      = EXCLUDED.exercise_guidance,
       things_to_avoid        = EXCLUDED.things_to_avoid,
       appointments_this_week = EXCLUDED.appointments_this_week,
       screening_tests        = EXCLUDED.screening_tests,
       checklist              = EXCLUDED.checklist,
       partner_tip            = EXCLUDED.partner_tip,
       affirmation            = EXCLUDED.affirmation,
       did_you_know           = EXCLUDED.did_you_know,
       sources                = EXCLUDED.sources,
       is_stub                = FALSE,
       generated_at           = now(),
       updated_at             = now()`,
    [
      week, PHASE, TRACK, LANGUAGE,

      // Build baby_size_description from the returned fields
      [c.babySizeDescription, c.babySizeFruitComparison && `(${c.babySizeFruitComparison})`]
        .filter(Boolean).join(' ') || `Week ${week}`,

      c.babySizeCm        ?? null,
      c.babyWeightGrams   ?? null,

      JSON.stringify(c.developmentHighlights     || []),
      JSON.stringify(c.organSystemsForming        || []),
      JSON.stringify(c.commonSymptoms             || []),

      // body_changes: join array into a single text value if array
      Array.isArray(c.momBodyChanges)
        ? c.momBodyChanges.join(' • ')
        : (c.momBodyChanges || null),

      c.emotionalChanges || null,

      // Merge flat nutrition tips + weeklyTip.nutrition into nutritionTips array
      JSON.stringify([
        ...(c.nutritionTips || []),
        ...(c.weeklyTip?.nutrition
          ? [{ tip: c.weeklyTip.nutrition, why: '' }]
          : []),
      ]),

      // exercise_guidance: merge exerciseGuidance + weeklyTip.movement
      [c.exerciseGuidance, c.weeklyTip?.movement].filter(Boolean).join(' ') || null,

      JSON.stringify(c.thingsToAvoid              || []),
      JSON.stringify(c.appointmentsThisWeek       || []),
      JSON.stringify(c.screeningTests             || []),

      // checklist: merge weeklyChecklist + questionsToAskDoctor as check items
      JSON.stringify([
        ...(c.weeklyChecklist || []),
        ...(c.questionsToAskDoctor || []).map((q) => ({ item: q, category: 'health' })),
        ...(c.weeklyTip?.sleep ? [{ item: c.weeklyTip.sleep, category: 'wellbeing' }] : []),
      ]),

      // Merge partner tips
      [c.partnerTip, c.weeklyTip?.partner].filter(Boolean).join(' — ') || null,

      c.affirmation || null,

      // did_you_know: merge fun fact + fun size comparison
      [c.didYouKnow, c.babySizeFunComparison && `Baby is about the size of ${c.babySizeFunComparison}.`]
        .filter(Boolean).join(' ') || null,

      JSON.stringify(c.sources || ['WHO', 'ACOG', 'NHS']),
    ]
  );
}

// ---------------------------------------------------------------------------
// Progress and cost helpers
// ---------------------------------------------------------------------------

// Rough token estimates per week (input + output)
const EST_INPUT_TOKENS  = 900;
const EST_OUTPUT_TOKENS = 900;

// claude-opus-4-8 pricing (MTok)
const PRICE_INPUT_PER_1M  = 15.00;
const PRICE_OUTPUT_PER_1M = 75.00;

function estimateCost(count) {
  const inputCost  = (count * EST_INPUT_TOKENS  / 1_000_000) * PRICE_INPUT_PER_1M;
  const outputCost = (count * EST_OUTPUT_TOKENS / 1_000_000) * PRICE_OUTPUT_PER_1M;
  return (inputCost + outputCost).toFixed(4);
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     Bloom — Weekly Pregnancy Content Generator       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Track    : ${TRACK}`);
  console.log(`  Language : ${LANGUAGE}`);
  console.log(`  Phase    : ${PHASE}`);
  console.log(`  Weeks    : ${FROM_W}–${TO_W} (${WEEKS.length} total)`);
  console.log(`  Delay    : ${DELAY_MS}ms between calls`);
  console.log(`  Dry run  : ${DRY_RUN}`);
  console.log(`  Force    : ${FORCE}`);
  console.log('');

  if (DRY_RUN) {
    console.log('[dry-run] Would generate weeks:', WEEKS.join(', '));
    console.log(`[dry-run] Estimated cost: ~$${estimateCost(WEEKS.length)}`);
    await db.end();
    return;
  }

  const existing = await fetchExistingWeeks();
  const toGenerate = FORCE
    ? WEEKS
    : WEEKS.filter((w) => !existing.has(w));

  const skipped = WEEKS.length - toGenerate.length;
  if (skipped > 0) {
    console.log(`  Skipping ${skipped} week(s) already in DB (use --force to overwrite)\n`);
  }

  if (toGenerate.length === 0) {
    console.log('✓ All weeks already generated. Nothing to do.');
    await db.end();
    return;
  }

  console.log(`  Generating ${toGenerate.length} week(s)...`);
  console.log(`  Estimated cost  : ~$${estimateCost(toGenerate.length)}`);
  console.log(`  Estimated time  : ~${formatDuration(toGenerate.length * (DELAY_MS + 3000))}`);
  console.log('');

  const startTime = Date.now();
  let done = 0;
  let failed = 0;
  const failures = [];

  for (const week of toGenerate) {
    const label = `Week ${pad2(week)}/${pad2(TO_W)}`;
    process.stdout.write(`  ${label} … `);

    const t0 = Date.now();
    try {
      const content = await jsonCall({
        system:     SYSTEM_PROMPT,
        userPrompt: buildWeekPrompt(week),
        maxTokens:  1400,
      });

      await upsertWeek(week, content);
      done++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`done ✓  (${elapsed}s)`);
    } catch (err) {
      failed++;
      failures.push({ week, error: err.message });
      console.log(`FAILED ✗  ${err.message.slice(0, 80)}`);
    }

    // Rate-limit delay (skip after last item)
    if (week !== toGenerate[toGenerate.length - 1] && DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const totalMs = Date.now() - startTime;

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Generated   : ${done}`);
  console.log(`  Skipped     : ${skipped}`);
  console.log(`  Failed      : ${failed}`);
  console.log(`  Time taken  : ${formatDuration(totalMs)}`);
  console.log(`  Cost est.   : ~$${estimateCost(done)}`);

  if (failures.length > 0) {
    console.log('');
    console.log('  Failed weeks:');
    failures.forEach(({ week: w, error }) => {
      console.log(`    Week ${pad2(w)}: ${error.slice(0, 100)}`);
    });
    console.log('');
    console.log('  Re-run with --force to retry failed weeks.');
  }

  console.log('');

  await db.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
