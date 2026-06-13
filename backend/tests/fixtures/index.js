// tests/fixtures/index.js
// Shared test data: user profiles per trimester, contraction logs, symptom logs.

// ── User profiles ─────────────────────────────────────────────────────────────

const PROFILE_WEEK_8 = {
  userId: 'user-week8',
  displayName: 'Amina',
  currentWeek: 8,
  trimester: 1,
  country: 'PK',
  language: 'ur',
  highRiskFlag: false,
  healthConditions: [],
};

const PROFILE_WEEK_24 = {
  userId: 'user-week24',
  displayName: 'Sofia',
  currentWeek: 24,
  trimester: 2,
  country: 'BR',
  language: 'pt',
  highRiskFlag: false,
  healthConditions: ['gestational diabetes'],
};

const PROFILE_WEEK_38 = {
  userId: 'user-week38',
  displayName: 'Emma',
  currentWeek: 38,
  trimester: 3,
  country: 'GB',
  language: 'en',
  highRiskFlag: true,
  healthConditions: ['pre-eclampsia history'],
};

// ── Contraction logs ──────────────────────────────────────────────────────────
// Helper: build events at a fixed interval/duration over a span.

function buildContractions({ count, intervalMin, durationSec, startISO = '2026-06-12T10:00:00Z' }) {
  const start = new Date(startISO).getTime();
  return Array.from({ length: count }, (_, i) => {
    const startedAt = new Date(start + i * intervalMin * 60_000);
    return {
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + durationSec * 1000).toISOString(),
      durationSec,
    };
  });
}

// Braxton Hicks: irregular, short, far apart (no pattern)
const CONTRACTIONS_BRAXTON_HICKS = [
  { startedAt: '2026-06-12T10:00:00Z', endedAt: '2026-06-12T10:00:25Z', durationSec: 25 },
  { startedAt: '2026-06-12T10:22:00Z', endedAt: '2026-06-12T10:22:30Z', durationSec: 30 },
  { startedAt: '2026-06-12T11:05:00Z', endedAt: '2026-06-12T11:05:20Z', durationSec: 20 },
  { startedAt: '2026-06-12T11:50:00Z', endedAt: '2026-06-12T11:50:35Z', durationSec: 35 },
];

// Early labour: ~10 min apart, ~45s, over 90 min — regular but not 5-1-1
const CONTRACTIONS_EARLY_LABOUR = buildContractions({
  count: 10, intervalMin: 10, durationSec: 45,
});

// Active labour: 4 min apart, 70s long, sustained 64 min — meets 5-1-1
const CONTRACTIONS_ACTIVE_LABOUR = buildContractions({
  count: 17, intervalMin: 4, durationSec: 70,
});

// ── Symptom logs ──────────────────────────────────────────────────────────────

const SYMPTOMS_NORMAL = [
  { symptomText: 'mild nausea in the morning', severity: 'mild' },
  { symptomText: 'lower back ache after standing', severity: 'mild' },
  { symptomText: 'occasional heartburn after meals', severity: 'moderate' },
  { symptomText: 'swollen ankles at the end of the day', severity: 'mild' },
];

const SYMPTOMS_URGENT = [
  'heavy bleeding since this morning',
  'I am soaking a pad every hour',
  'baby has no movement since yesterday',
  'the baby is not moving today',
  'sharp chest pain when I breathe',
  "I can't breathe properly",
  'difficulty breathing when lying down',
  'severe abdominal cramping',
  'I passed out in the kitchen',
  'I fainted at work',
  'blurry vision and headache',
  'blurred sight and seeing flashes',
  'seeing spots in front of my eyes',
  'sudden severe headache that came out of nowhere',
  'I think my water broke',
  'worried about preterm labour at 33 weeks',
  'I am scared I am having a miscarriage',
  'I had a seizure an hour ago',
];

module.exports = {
  PROFILE_WEEK_8,
  PROFILE_WEEK_24,
  PROFILE_WEEK_38,
  buildContractions,
  CONTRACTIONS_BRAXTON_HICKS,
  CONTRACTIONS_EARLY_LABOUR,
  CONTRACTIONS_ACTIVE_LABOUR,
  SYMPTOMS_NORMAL,
  SYMPTOMS_URGENT,
};
