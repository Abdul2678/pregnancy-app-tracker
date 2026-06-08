#!/usr/bin/env node
/**
 * scripts/generatePushNotifications.js
 *
 * Pre-generates 7 push notification messages per pregnancy week
 * (weeks 1–40 = 280 total) and stores them in push_notification_copy.
 *
 * The 7 categories are:
 *   weekly_update  — main weekly milestone notification
 *   nutrition      — food/supplement nudge
 *   movement       — exercise/movement reminder
 *   symptom        — symptom awareness tip
 *   partner        — message for/about the support person
 *   preparation    — nesting/admin task
 *   affirmation    — short positive message
 *
 * Safe to re-run: skips (week, category) pairs already in DB.
 * Use --force to overwrite existing copy.
 *
 * Usage:
 *   node scripts/generatePushNotifications.js
 *   node scripts/generatePushNotifications.js --weeks 20-28 --language es
 *   node scripts/generatePushNotifications.js --week 12 --force
 *   node scripts/generatePushNotifications.js --dry-run
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const db           = require('../src/db');
const { jsonCall } = require('../src/lib/claude');

// ---------------------------------------------------------------------------
// Push notification categories and their character limits
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    key:   'weekly_update',
    label: 'Weekly Milestone',
    titleMax: 40,
    bodyMax:  110,
    tone:  'exciting milestone reveal',
  },
  {
    key:   'nutrition',
    label: 'Nutrition Nudge',
    titleMax: 40,
    bodyMax:  100,
    tone:  'friendly nutrition tip relevant to this exact week',
  },
  {
    key:   'movement',
    label: 'Movement Reminder',
    titleMax: 40,
    bodyMax:  100,
    tone:  'gentle, encouraging exercise or movement prompt for this week',
  },
  {
    key:   'symptom',
    label: 'Symptom Awareness',
    titleMax: 40,
    bodyMax:  110,
    tone:  'reassuring symptom heads-up or relief tip relevant to this week',
  },
  {
    key:   'partner',
    label: 'Partner Tip',
    titleMax: 40,
    bodyMax:  110,
    tone:  'warm tip for the partner or support person about what\'s happening this week',
  },
  {
    key:   'preparation',
    label: 'Preparation Task',
    titleMax: 40,
    bodyMax:  100,
    tone:  'practical nesting, admin, or hospital-prep task appropriate for this week',
  },
  {
    key:   'affirmation',
    label: 'Affirmation',
    titleMax: 40,
    bodyMax:  100,
    tone:  'short, genuine, non-clichéd affirmation for the pregnant person',
  },
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name)     { return argv.includes(`--${name}`); }
function opt(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}

const LANGUAGE = opt('language', 'en');
const PHASE    = opt('phase',    'pregnancy');
const DELAY_MS = parseInt(opt('delay', '800'), 10);
const DRY_RUN  = flag('dry-run');
const FORCE    = flag('force');

// --weeks 20-28  or  --week 12
const WEEKS_OPT = opt('weeks', opt('week', '1-40'));
const [FROM_W, TO_W] = WEEKS_OPT.includes('-')
  ? WEEKS_OPT.split('-').map(Number)
  : [Number(WEEKS_OPT), Number(WEEKS_OPT)];

const WEEKS = Array.from({ length: TO_W - FROM_W + 1 }, (_, i) => FROM_W + i)
  .filter((w) => w >= 1 && w <= 42);

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You write push notification copy for Bloom, a warm global pregnancy app.
Rules:
- Titles: MAXIMUM ${Math.max(...CATEGORIES.map((c) => c.titleMax))} characters. Short, specific, no emoji unless natural.
- Bodies: MAXIMUM ${Math.max(...CATEGORIES.map((c) => c.bodyMax))} characters. Conversational, not clinical.
- Language: ${LANGUAGE}. Culturally inclusive and globally appropriate.
- Never use "mama", "mommy" — use "you" or the person's journey.
- No exclamation marks in every message — vary energy levels.
- Return ONLY valid JSON — no markdown fences, no preamble.`;

/**
 * Asks Claude for all 7 categories for a single week in one API call.
 * @param {number} week
 * @returns {string} JSON prompt
 */
function buildBatchPrompt(week) {
  const trimester = week <= 13 ? 1 : week <= 26 ? 2 : 3;
  const catList = CATEGORIES.map((c) =>
    `  "${c.key}": { "title": "...", "body": "..." }  // ${c.tone}`
  ).join('\n');

  return `Write 7 push notifications for pregnancy week ${week} (trimester ${trimester}).
Language: ${LANGUAGE}. Phase: ${PHASE}.

Each notification has a title (≤40 chars) and body (≤110 chars).
The tone for each category is described in the comment.

Return EXACTLY this JSON — fill in all 7 entries:
{
${catList}
}`;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Set of "week:category" strings already in the DB.
 */
async function fetchExistingKeys() {
  const { rows } = await db.query(
    `SELECT week, category FROM push_notification_copy
     WHERE phase = $1 AND language = $2`,
    [PHASE, LANGUAGE]
  );
  return new Set(rows.map((r) => `${r.week}:${r.category}`));
}

/**
 * Upserts all 7 category rows for a week.
 * @param {number} week
 * @param {object} notifications  { weekly_update: {title, body}, ... }
 */
async function upsertWeekNotifications(week, notifications) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const cat of CATEGORIES) {
      const n = notifications[cat.key];
      if (!n?.title || !n?.body) {
        console.warn(`    ⚠ Missing ${cat.key} for week ${week} — skipping`);
        continue;
      }

      // Enforce char limits with hard truncation + ellipsis
      const title = n.title.length > cat.titleMax
        ? n.title.slice(0, cat.titleMax - 1) + '…'
        : n.title;
      const body  = n.body.length > cat.bodyMax
        ? n.body.slice(0, cat.bodyMax - 1) + '…'
        : n.body;

      await client.query(
        `INSERT INTO push_notification_copy (week, phase, language, category, title, body)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (week, phase, language, category)
         DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body`,
        [week, PHASE, LANGUAGE, cat.key, title, body]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

// Each batch call: ~400 input + ~300 output tokens
const EST_INPUT_PER_WEEK  = 450;
const EST_OUTPUT_PER_WEEK = 350;

// claude-opus-4-8 pricing
const PRICE_INPUT_PER_1M  = 15.00;
const PRICE_OUTPUT_PER_1M = 75.00;

function estimateCost(count) {
  const inputCost  = (count * EST_INPUT_PER_WEEK  / 1_000_000) * PRICE_INPUT_PER_1M;
  const outputCost = (count * EST_OUTPUT_PER_WEEK / 1_000_000) * PRICE_OUTPUT_PER_1M;
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
  console.log('║     Bloom — Push Notification Copy Generator         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Language  : ${LANGUAGE}`);
  console.log(`  Phase     : ${PHASE}`);
  console.log(`  Weeks     : ${FROM_W}–${TO_W} (${WEEKS.length} weeks)`);
  console.log(`  Per week  : ${CATEGORIES.length} categories`);
  console.log(`  Total     : ${WEEKS.length * CATEGORIES.length} notifications`);
  console.log(`  Delay     : ${DELAY_MS}ms between API calls`);
  console.log(`  Dry run   : ${DRY_RUN}`);
  console.log(`  Force     : ${FORCE}`);
  console.log('');

  if (DRY_RUN) {
    console.log('[dry-run] Would generate weeks:', WEEKS.join(', '));
    console.log(`[dry-run] Estimated cost: ~$${estimateCost(WEEKS.length)}`);
    await db.end();
    return;
  }

  const existing = await fetchExistingKeys();

  // Determine which weeks need ANY generation (skip only if ALL 7 present + no --force)
  const toGenerate = FORCE
    ? WEEKS
    : WEEKS.filter((w) =>
        CATEGORIES.some((c) => !existing.has(`${w}:${c.key}`))
      );

  const skipped = WEEKS.length - toGenerate.length;
  if (skipped > 0) {
    console.log(`  Skipping ${skipped} week(s) fully complete in DB (use --force to overwrite)\n`);
  }

  if (toGenerate.length === 0) {
    console.log('✓ All notifications already generated. Nothing to do.');
    await db.end();
    return;
  }

  console.log(`  Generating ${toGenerate.length} week(s) × 7 = ${toGenerate.length * 7} notifications...`);
  console.log(`  Estimated cost  : ~$${estimateCost(toGenerate.length)}`);
  console.log(`  Estimated time  : ~${formatDuration(toGenerate.length * (DELAY_MS + 2500))}`);
  console.log('');

  const startTime = Date.now();
  let done = 0;
  let failed = 0;
  const failures = [];

  for (const week of toGenerate) {
    const label = `Week ${pad2(week)}/${pad2(TO_W)}`;
    process.stdout.write(`  ${label} (7 msgs) … `);

    const t0 = Date.now();
    try {
      const notifications = await jsonCall({
        system:     SYSTEM_PROMPT,
        userPrompt: buildBatchPrompt(week),
        maxTokens:  700,
      });

      await upsertWeekNotifications(week, notifications);
      done++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`done ✓  (${elapsed}s)`);
    } catch (err) {
      failed++;
      failures.push({ week, error: err.message });
      console.log(`FAILED ✗  ${err.message.slice(0, 80)}`);
    }

    if (week !== toGenerate[toGenerate.length - 1] && DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const totalMs   = Date.now() - startTime;
  const totalRows = done * CATEGORIES.length;

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Weeks generated : ${done}`);
  console.log(`  Rows written    : ${totalRows}`);
  console.log(`  Weeks skipped   : ${skipped}`);
  console.log(`  Weeks failed    : ${failed}`);
  console.log(`  Time taken      : ${formatDuration(totalMs)}`);
  console.log(`  Cost estimate   : ~$${estimateCost(done)}`);

  if (failures.length > 0) {
    console.log('');
    console.log('  Failed weeks:');
    failures.forEach(({ week: w, error }) => {
      console.log(`    Week ${pad2(w)}: ${error.slice(0, 100)}`);
    });
    console.log('');
    console.log('  Re-run with the same options to retry (failed weeks are not in DB).');
    console.log('  Or use --force --weeks <range> to overwrite specific weeks.');
  }

  console.log('');

  await db.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
