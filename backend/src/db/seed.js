// db/seed.js
// Seeds emergency resources by country and stub weekly content for all 40 weeks.

require('dotenv').config();
const { pool } = require('./index');

const EMERGENCY_RESOURCES = [
  {
    country: 'US',
    language: 'English',
    emergency_number: '911',
    resources: [
      { name: 'Postpartum Support International', contact: '1-800-944-4773' },
      { name: 'National Maternal Mental Health Hotline', contact: '1-833-852-6262' },
      { name: '988 Suicide & Crisis Lifeline', contact: '988' },
    ],
  },
  {
    country: 'GB',
    language: 'English',
    emergency_number: '999',
    resources: [
      { name: 'NHS 111', contact: '111' },
      { name: 'Samaritans', contact: '116 123' },
      { name: 'PANDAS (perinatal mental health)', contact: '0808 1961 776' },
    ],
  },
  {
    country: 'IN',
    language: 'English',
    emergency_number: '112',
    resources: [
      { name: 'National Ambulance', contact: '108' },
      { name: 'iCall Psychosocial Helpline', contact: '9152987821' },
    ],
  },
  {
    country: 'PK',
    language: 'English',
    emergency_number: '1122',
    resources: [
      { name: 'Edhi Ambulance', contact: '115' },
      { name: 'Umang Mental Health Helpline', contact: '0311 7786264' },
    ],
  },
  {
    country: 'AU',
    language: 'English',
    emergency_number: '000',
    resources: [
      { name: 'PANDA (Perinatal Anxiety & Depression Australia)', contact: '1300 726 306' },
      { name: 'Lifeline', contact: '13 11 14' },
    ],
  },
  {
    country: 'unknown',
    language: 'English',
    emergency_number: '112',
    resources: [
      { name: 'International emergency number', contact: '112 / 911 / 999' },
    ],
  },
];

function stubWeekContent(week) {
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  return {
    week,
    trimester,
    babySize: `Baby development for week ${week} (stub — regenerate via content generator).`,
    babySizeComparison: 'fruit/vegetable comparison placeholder',
    development: `Key fetal development milestones for week ${week}.`,
    momChanges: `Common changes you may experience in week ${week}.`,
    tips: [
      `Tip 1 for week ${week}`,
      `Tip 2 for week ${week}`,
    ],
    checklist: [`Checklist item for week ${week}`],
    isStub: true,
  };
}

async function seed() {
  // Emergency resources
  for (const r of EMERGENCY_RESOURCES) {
    await pool.query(
      `INSERT INTO emergency_resources (country, language, emergency_number, resources)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (country, language) DO UPDATE
         SET emergency_number = EXCLUDED.emergency_number,
             resources = EXCLUDED.resources`,
      [r.country, r.language, r.emergency_number, JSON.stringify(r.resources)]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] emergency_resources: ${EMERGENCY_RESOURCES.length} rows`);

  // Stub weekly content (weeks 1-40, standard track, English)
  for (let week = 1; week <= 40; week += 1) {
    await pool.query(
      `INSERT INTO weekly_content (week, track, language, phase, content)
       VALUES ($1, 'standard', 'English', 'pregnancy', $2)
       ON CONFLICT (week, track, language, phase) DO NOTHING`,
      [week, JSON.stringify(stubWeekContent(week))]
    );
  }
  // eslint-disable-next-line no-console
  console.log('[seed] weekly_content: 40 stub weeks');

  // A couple of stub push notifications
  for (let week = 1; week <= 40; week += 1) {
    await pool.query(
      `INSERT INTO push_notifications (week, language, phase, title, body, category)
       VALUES ($1, 'English', 'pregnancy', $2, $3, 'weekly')
       ON CONFLICT (week, language, phase, category) DO NOTHING`,
      [week, `Week ${week} update`, `See what's happening in week ${week} of your pregnancy.`]
    );
  }
  // eslint-disable-next-line no-console
  console.log('[seed] push_notifications: 40 stub weeks');
}

seed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('[seed] done');
    return pool.end();
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed', err);
    pool.end();
    process.exit(1);
  });
