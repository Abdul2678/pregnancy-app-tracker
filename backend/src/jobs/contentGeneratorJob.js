// jobs/contentGeneratorJob.js
// One-time build job: generate all 40 weeks of development content + push copy,
// across the requested languages. Run via `npm run generate:content`.

require('dotenv').config();
const { pool } = require('../db');
const { generateAllWeeks } = require('../services/contentGenerator');
const { generateAllPushCopy } = require('../services/pushNotifications');

const LANGUAGES = (process.env.CONTENT_LANGUAGES || 'English').split(',').map((s) => s.trim());
const TRACK = process.env.CONTENT_TRACK || 'standard';

async function run() {
  // eslint-disable-next-line no-console
  console.log(`[job:contentGenerator] generating for languages=[${LANGUAGES.join(', ')}] track=${TRACK}`);

  for (const language of LANGUAGES) {
    // Pregnancy weeks 1-40
    await generateAllWeeks({ track: TRACK, language, phase: 'pregnancy' });
    await generateAllPushCopy({ language, phase: 'pregnancy' });

    // Newborn weeks 0-12
    await generateAllWeeks({
      track: TRACK,
      language,
      phase: 'newborn',
      weeks: Array.from({ length: 13 }, (_, i) => i),
    });
    await generateAllPushCopy({
      language,
      phase: 'newborn',
      weeks: Array.from({ length: 13 }, (_, i) => i),
    });
  }

  // eslint-disable-next-line no-console
  console.log('[job:contentGenerator] complete');
}

run()
  .then(() => pool.end())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[job:contentGenerator] failed', err);
    pool.end();
    process.exit(1);
  });
