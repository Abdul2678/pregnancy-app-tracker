// db/seed.js
// Seeds all static/reference data + one test user at week 12.
// Run: node src/db/seed.js

require('dotenv').config();
const { pool } = require('./index');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

// =============================================================================
// Reference data
// =============================================================================

const EMERGENCY_RESOURCES = [
  {
    country: 'US', language: 'en',
    emergency_number: '911', ambulance_number: '911',
    mental_health_line: '988',
    resources: [
      { name: 'National Maternal Mental Health Hotline', contact: '1-833-943-5746', hours: '24/7' },
      { name: 'Postpartum Support International',        contact: '1-800-944-4773', hours: 'Mon-Fri 9am-7pm ET' },
      { name: '988 Suicide & Crisis Lifeline',           contact: '988',            hours: '24/7' },
      { name: 'Poison Control',                          contact: '1-800-222-1222', hours: '24/7' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'GB', language: 'en',
    emergency_number: '999', ambulance_number: '999',
    mental_health_line: '116 123',
    resources: [
      { name: 'NHS 111',                                contact: '111',          hours: '24/7' },
      { name: 'Samaritans',                             contact: '116 123',      hours: '24/7' },
      { name: 'PANDAS (Perinatal Mental Health)',        contact: '0808 1961 776', hours: 'Mon-Sun 9am-8pm' },
      { name: 'Tommy\'s Midwife Helpline',              contact: '0800 014 7800', hours: '9am-5pm weekdays' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'AU', language: 'en',
    emergency_number: '000', ambulance_number: '000',
    mental_health_line: '13 11 14',
    resources: [
      { name: 'PANDA (Perinatal Anxiety & Depression Australia)', contact: '1300 726 306', hours: 'Mon-Sat 9am-7:30pm AEST' },
      { name: 'Lifeline',                               contact: '13 11 14',    hours: '24/7' },
      { name: 'Beyond Blue',                            contact: '1300 22 4636', hours: '24/7' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'CA', language: 'en',
    emergency_number: '911', ambulance_number: '911',
    mental_health_line: '1-833-456-4566',
    resources: [
      { name: 'Crisis Services Canada',                 contact: '1-833-456-4566', hours: '24/7' },
      { name: 'Pacific Postpartum Support Society',     contact: '604-255-7999',   hours: 'Mon-Fri' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'IN', language: 'en',
    emergency_number: '112', ambulance_number: '108',
    mental_health_line: '9152987821',
    resources: [
      { name: 'National Ambulance Service',             contact: '108',           hours: '24/7' },
      { name: 'iCall Psychosocial Helpline (TISS)',     contact: '9152987821',    hours: 'Mon-Sat 8am-10pm' },
      { name: 'Vandrevala Foundation',                  contact: '1860-2662-345', hours: '24/7' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'PK', language: 'en',
    emergency_number: '1122', ambulance_number: '115',
    mental_health_line: '0311-7786264',
    resources: [
      { name: 'Edhi Ambulance',                         contact: '115',            hours: '24/7' },
      { name: 'Umang Mental Health Helpline',           contact: '0311-7786264',   hours: 'Mon-Sat 9am-9pm' },
      { name: 'Rescue 1122',                            contact: '1122',           hours: '24/7' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'PK', language: 'ur',
    emergency_number: '1122', ambulance_number: '115',
    mental_health_line: '0311-7786264',
    resources: [
      { name: 'ایدھی ایمبولینس',    contact: '115',          hours: '24 گھنٹے' },
      { name: 'امنگ ہیلپ لائن',     contact: '0311-7786264', hours: 'پیر-ہفتہ 9am-9pm' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'NG', language: 'en',
    emergency_number: '112', ambulance_number: '112',
    mental_health_line: '0800-789-0000',
    resources: [
      { name: 'Nigeria Emergency Management Agency',    contact: '0800-CALL-NEMA', hours: '24/7' },
      { name: 'Mental Health Foundation Nigeria',       contact: '0800-789-0000',  hours: 'Mon-Fri' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'BR', language: 'pt',
    emergency_number: '192', ambulance_number: '192',
    mental_health_line: '188',
    resources: [
      { name: 'SAMU (Serviço de Atendimento Móvel)',   contact: '192',  hours: '24h' },
      { name: 'CVV (Centro de Valorização da Vida)',    contact: '188',  hours: '24h' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'MX', language: 'es',
    emergency_number: '911', ambulance_number: '911',
    mental_health_line: '800 290 0024',
    resources: [
      { name: 'SAPTEL (crisis telefónica)',             contact: '55 5259-8121', hours: '24h' },
      { name: 'CONASAMA Línea de la vida',              contact: '800 911 2000', hours: '24h' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'SA', language: 'ar',
    emergency_number: '911', ambulance_number: '911',
    mental_health_line: '920033360',
    resources: [
      { name: 'الهلال الأحمر السعودي', contact: '997', hours: '24/7' },
      { name: 'خط مساندة للصحة النفسية', contact: '920033360', hours: '24/7' },
    ],
    last_verified_at: '2024-01-01',
  },
  {
    country: 'unknown', language: 'en',
    emergency_number: '112', ambulance_number: '112',
    mental_health_line: null,
    resources: [
      { name: 'International Emergency (GSM)',          contact: '112', hours: '24/7' },
      { name: 'WHO Mental Health Helpfinder',           url: 'https://www.who.int/mental_health', hours: '' },
    ],
    last_verified_at: '2024-01-01',
  },
];

// Hospital bag template items
const HOSPITAL_BAG_TEMPLATE = [
  // Documents
  { key: 'doc_id',            name: 'Photo ID / Passport',                    category: 'documents',         is_essential: true,  sort_order: 1  },
  { key: 'doc_insurance',     name: 'Insurance card / maternity notes',       category: 'documents',         is_essential: true,  sort_order: 2  },
  { key: 'doc_birth_plan',    name: 'Printed birth plan (3 copies)',          category: 'documents',         is_essential: false, sort_order: 3  },
  { key: 'doc_provider',      name: 'OB / midwife contact numbers',           category: 'documents',         is_essential: true,  sort_order: 4  },
  // Labour & delivery
  { key: 'lab_gown',          name: 'Comfortable labour gown or robe',        category: 'labour',            is_essential: false, sort_order: 10 },
  { key: 'lab_socks',         name: 'Non-slip socks (2 pairs)',               category: 'labour',            is_essential: true,  sort_order: 11 },
  { key: 'lab_hair',          name: 'Hair ties / headband',                   category: 'labour',            is_essential: false, sort_order: 12 },
  { key: 'lab_music',         name: 'Headphones + labour playlist',           category: 'labour',            is_essential: false, sort_order: 13 },
  { key: 'lab_snacks',        name: 'Snacks for partner',                     category: 'labour',            is_essential: false, sort_order: 14 },
  { key: 'lab_pillow',        name: 'Your own pillow (pillowcase)',           category: 'labour',            is_essential: false, sort_order: 15 },
  { key: 'lab_lip_balm',      name: 'Lip balm',                               category: 'labour',            is_essential: false, sort_order: 16 },
  { key: 'lab_charger',       name: 'Phone charger + power bank',             category: 'labour',            is_essential: true,  sort_order: 17 },
  { key: 'lab_camera',        name: 'Camera or confirm phone storage',        category: 'labour',            is_essential: false, sort_order: 18 },
  // Postpartum for parent
  { key: 'pp_pads',           name: 'Maternity pads (heavy flow)',            category: 'postpartum_parent', is_essential: true,  sort_order: 20 },
  { key: 'pp_underwear',      name: 'Disposable or mesh underwear (5+)',      category: 'postpartum_parent', is_essential: true,  sort_order: 21 },
  { key: 'pp_nursing_bra',    name: 'Nursing bra or sleep bra (2)',           category: 'postpartum_parent', is_essential: true,  sort_order: 22 },
  { key: 'pp_pjs',            name: 'Comfortable pyjamas (front-opening)',    category: 'postpartum_parent', is_essential: true,  sort_order: 23 },
  { key: 'pp_toiletries',     name: 'Toiletries bag (toothbrush, shampoo…)',  category: 'postpartum_parent', is_essential: true,  sort_order: 24 },
  { key: 'pp_nipple_cream',   name: 'Nipple cream (lanolin)',                 category: 'postpartum_parent', is_essential: false, sort_order: 25 },
  { key: 'pp_breast_pads',    name: 'Breast pads (disposable)',               category: 'postpartum_parent', is_essential: false, sort_order: 26 },
  { key: 'pp_going_home',     name: 'Going-home outfit (loose)',              category: 'postpartum_parent', is_essential: true,  sort_order: 27 },
  // Baby
  { key: 'baby_onesies',      name: 'Onesies — newborn size (3–4)',           category: 'baby',              is_essential: true,  sort_order: 30 },
  { key: 'baby_sleepsuit',    name: 'Sleep suits (2)',                        category: 'baby',              is_essential: true,  sort_order: 31 },
  { key: 'baby_hat',          name: 'Newborn hat',                            category: 'baby',              is_essential: true,  sort_order: 32 },
  { key: 'baby_mittens',      name: 'Scratch mittens',                        category: 'baby',              is_essential: false, sort_order: 33 },
  { key: 'baby_blanket',      name: 'Swaddle blanket',                        category: 'baby',              is_essential: true,  sort_order: 34 },
  { key: 'baby_nappies',      name: 'Nappies / diapers — newborn size (12)', category: 'baby',              is_essential: true,  sort_order: 35 },
  { key: 'baby_wipes',        name: 'Fragrance-free baby wipes',             category: 'baby',              is_essential: true,  sort_order: 36 },
  { key: 'baby_car_seat',     name: 'Car seat (installed & inspected)',       category: 'baby',              is_essential: true,  sort_order: 37 },
  // Partner / support
  { key: 'partner_clothes',   name: 'Change of clothes for 2 days',          category: 'partner',           is_essential: true,  sort_order: 40 },
  { key: 'partner_snacks',    name: 'Snacks, drinks, cash',                  category: 'partner',           is_essential: false, sort_order: 41 },
  { key: 'partner_pillow',    name: 'Travel pillow / blanket',               category: 'partner',           is_essential: false, sort_order: 42 },
  { key: 'partner_charger',   name: 'Charger for own devices',               category: 'partner',           is_essential: true,  sort_order: 43 },
  { key: 'partner_tasks',     name: 'List of people to call after birth',    category: 'partner',           is_essential: false, sort_order: 44 },
];

// Stub weekly content generator (real content generated by contentGeneratorJob)
function makeWeekStub(week) {
  const trimester = week <= 13 ? 1 : week <= 26 ? 2 : 3;
  const sizes = [
    null,'poppy seed','sesame seed','lentil','blueberry','pea','sweet pea',
    'raspberry','kidney bean','grape','strawberry','lime','plum',
    'peach','lemon','apple','avocado','pear','sweet potato','mango',
    'banana','endive','spaghetti squash','corn','rutabaga',
    'eggplant','scallion','cauliflower','butternut squash','cabbage',
    'bunch of bananas','coconut','pineapple','cantaloupe','honeydew melon',
    'crenshaw melon','Swiss chard','winter melon','mini watermelon',
    'watermelon','pumpkin',
  ];
  return {
    week,
    trimester,
    phase: 'pregnancy',
    track: 'standard',
    language: 'en',
    baby_size_description: sizes[week] ? `about the size of a ${sizes[week]}` : `week ${week}`,
    baby_size_cm: null,
    baby_weight_grams: null,
    development_highlights: [`Key fetal development for week ${week} (stub — regenerate via content generator)`],
    organ_systems_forming: [],
    common_symptoms: [],
    body_changes: `Common body changes in week ${week}.`,
    emotional_changes: null,
    nutrition_tips: [],
    exercise_guidance: null,
    things_to_avoid: [],
    appointments_this_week: [],
    screening_tests: [],
    checklist: [{ item: `Week ${week} checklist item`, category: 'health' }],
    partner_tip: null,
    affirmation: null,
    did_you_know: null,
    sources: ['WHO', 'ACOG'],
    is_stub: true,
  };
}

function makeNewbornWeekStub(week) {
  return {
    week,
    trimester: null,
    phase: 'newborn',
    track: 'standard',
    language: 'en',
    baby_size_description: `${week}-week-old newborn`,
    baby_size_cm: null,
    baby_weight_grams: null,
    development_highlights: [`Newborn development milestones for week ${week} (stub)`],
    organ_systems_forming: [],
    common_symptoms: [],
    body_changes: `Postpartum recovery notes for week ${week}.`,
    emotional_changes: null,
    nutrition_tips: [],
    exercise_guidance: null,
    things_to_avoid: [],
    appointments_this_week: [],
    screening_tests: [],
    checklist: [],
    partner_tip: null,
    affirmation: null,
    did_you_know: null,
    sources: ['WHO', 'AAP'],
    is_stub: true,
  };
}

// =============================================================================
// Test user — week 12, first pregnancy, Pakistan, English
// =============================================================================
const TEST_USER = {
  email:        'test@bloom.app',
  password:     'TestPassword123!',
  display_name: 'Sarah (Test)',
  country:      'PK',
  language:     'en',
  // LMP that puts us at week 12 as of seed date
  // week 12: LMP was ~84 days ago from 2026-06-07 → 2026-03-15
  lmp_date:     '2026-03-15',
  due_date:     '2026-12-20',
  current_week: 12,
  trimester:    1,
};

// =============================================================================
// Seeder
// =============================================================================
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Emergency resources ───────────────────────────────────────────────
    console.log('[seed] Inserting emergency resources…');
    for (const r of EMERGENCY_RESOURCES) {
      await client.query(
        `INSERT INTO emergency_resources
           (country, language, emergency_number, ambulance_number,
            mental_health_line, resources, last_verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (country, language) DO UPDATE SET
           emergency_number   = EXCLUDED.emergency_number,
           ambulance_number   = EXCLUDED.ambulance_number,
           mental_health_line = EXCLUDED.mental_health_line,
           resources          = EXCLUDED.resources,
           last_verified_at   = EXCLUDED.last_verified_at`,
        [r.country, r.language, r.emergency_number, r.ambulance_number ?? null,
         r.mental_health_line ?? null, JSON.stringify(r.resources), r.last_verified_at]
      );
    }
    console.log(`[seed] ✓ emergency_resources: ${EMERGENCY_RESOURCES.length} rows`);

    // ── 2. Weekly content stubs (weeks 1–40 pregnancy + weeks 0–12 newborn) ─
    console.log('[seed] Inserting pregnancy week stubs…');
    for (let w = 1; w <= 40; w++) {
      const stub = makeWeekStub(w);
      await client.query(
        `INSERT INTO pregnancy_weeks_cache
           (week, phase, track, language, baby_size_description, baby_size_cm,
            baby_weight_grams, development_highlights, organ_systems_forming,
            common_symptoms, body_changes, emotional_changes, nutrition_tips,
            exercise_guidance, things_to_avoid, appointments_this_week,
            screening_tests, checklist, partner_tip, affirmation, did_you_know,
            sources, is_stub)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         ON CONFLICT (week, phase, track, language) DO NOTHING`,
        [
          stub.week, stub.phase, stub.track, stub.language,
          stub.baby_size_description, stub.baby_size_cm, stub.baby_weight_grams,
          JSON.stringify(stub.development_highlights),
          JSON.stringify(stub.organ_systems_forming),
          JSON.stringify(stub.common_symptoms),
          stub.body_changes, stub.emotional_changes,
          JSON.stringify(stub.nutrition_tips),
          stub.exercise_guidance,
          JSON.stringify(stub.things_to_avoid),
          JSON.stringify(stub.appointments_this_week),
          JSON.stringify(stub.screening_tests),
          JSON.stringify(stub.checklist),
          stub.partner_tip, stub.affirmation, stub.did_you_know,
          JSON.stringify(stub.sources), stub.is_stub,
        ]
      );
    }

    for (let w = 0; w <= 12; w++) {
      const stub = makeNewbornWeekStub(w);
      await client.query(
        `INSERT INTO pregnancy_weeks_cache
           (week, phase, track, language, baby_size_description, baby_size_cm,
            baby_weight_grams, development_highlights, organ_systems_forming,
            common_symptoms, body_changes, emotional_changes, nutrition_tips,
            exercise_guidance, things_to_avoid, appointments_this_week,
            screening_tests, checklist, partner_tip, affirmation, did_you_know,
            sources, is_stub)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         ON CONFLICT (week, phase, track, language) DO NOTHING`,
        [
          stub.week, stub.phase, stub.track, stub.language,
          stub.baby_size_description, stub.baby_size_cm, stub.baby_weight_grams,
          JSON.stringify(stub.development_highlights),
          JSON.stringify(stub.organ_systems_forming),
          JSON.stringify(stub.common_symptoms),
          stub.body_changes, stub.emotional_changes,
          JSON.stringify(stub.nutrition_tips),
          stub.exercise_guidance,
          JSON.stringify(stub.things_to_avoid),
          JSON.stringify(stub.appointments_this_week),
          JSON.stringify(stub.screening_tests),
          JSON.stringify(stub.checklist),
          stub.partner_tip, stub.affirmation, stub.did_you_know,
          JSON.stringify(stub.sources), stub.is_stub,
        ]
      );
    }
    console.log('[seed] ✓ pregnancy_weeks_cache: 40 pregnancy + 13 newborn stub rows');

    // ── 3. Push notification copy stubs ─────────────────────────────────────
    console.log('[seed] Inserting push notification copy stubs…');
    for (let w = 1; w <= 40; w++) {
      await client.query(
        `INSERT INTO push_notification_copy (week, phase, language, category, title, body)
         VALUES ($1,'pregnancy','en','weekly',$2,$3)
         ON CONFLICT (week, phase, language, category) DO NOTHING`,
        [w, `Week ${w}: Your pregnancy update`, `See what's new for you and your baby this week.`]
      );
    }
    for (let w = 0; w <= 12; w++) {
      await client.query(
        `INSERT INTO push_notification_copy (week, phase, language, category, title, body)
         VALUES ($1,'newborn','en','weekly',$2,$3)
         ON CONFLICT (week, phase, language, category) DO NOTHING`,
        [w, `Your baby is ${w} week${w !== 1 ? 's' : ''} old`, `Track feeds, sleep, and development milestones this week.`]
      );
    }
    console.log('[seed] ✓ push_notification_copy: 53 stub rows');

    // ── 4. Test user ─────────────────────────────────────────────────────────
    console.log('[seed] Creating test user…');
    const passwordHash = await bcrypt.hash(TEST_USER.password, 12);

    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, display_name, email_verified)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         display_name  = EXCLUDED.display_name
       RETURNING id`,
      [TEST_USER.email, passwordHash, TEST_USER.display_name]
    );
    const userId = user.id;

    // User profile
    await client.query(
      `INSERT INTO user_profiles
         (user_id, age, country, language, timezone, unit_system,
          health_conditions, dietary_restrictions, goals,
          feature_priorities, notif_pref, onboarding_message)
       VALUES ($1,$2,$3,$4,'Asia/Karachi','metric','[]','[]',
               $5,$6,'daily',$7)
       ON CONFLICT (user_id) DO UPDATE SET
         country            = EXCLUDED.country,
         language           = EXCLUDED.language,
         onboarding_message = EXCLUDED.onboarding_message`,
      [
        userId, 29, TEST_USER.country, TEST_USER.language,
        JSON.stringify(['track_symptoms', 'learn', 'community']),
        JSON.stringify(['track_symptoms', 'learn', 'chat', 'weight', 'appointments']),
        'Welcome to Bloom, Sarah! You\'re 12 weeks pregnant — a fantastic milestone. Your baby is now the size of a plum and most of the critical organs have formed. Let\'s make this journey as smooth as possible.',
      ]
    );

    // Pregnancy
    const { rows: [pregnancy] } = await client.query(
      `INSERT INTO pregnancies
         (user_id, lmp_date, due_date, calculated_due_date,
          current_week, trimester, is_first_pregnancy,
          is_ivf, high_risk_flag, content_track, outcome)
       VALUES ($1,$2,$3,$3,$4,$5,TRUE,FALSE,FALSE,'standard','ongoing')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [userId, TEST_USER.lmp_date, TEST_USER.due_date, TEST_USER.current_week, TEST_USER.trimester]
    );
    const pregnancyId = pregnancy?.id;

    if (pregnancyId) {
      // Symptom log samples
      const symptoms = [
        { name: 'nausea',    severity: 3, hours: 2,   week: 10, note: 'Mostly in the morning' },
        { name: 'fatigue',   severity: 4, hours: null, week: 11, note: null },
        { name: 'heartburn', severity: 2, hours: 1,   week: 12, note: 'After dinner' },
      ];
      for (const s of symptoms) {
        await client.query(
          `INSERT INTO symptom_logs
             (user_id, pregnancy_id, symptom_name, severity, duration_hours,
              pregnancy_week, trimester, notes, logged_at)
           VALUES ($1,$2,$3,$4,$5,$6,1,$7, now() - ($8 || ' days')::interval)`,
          [userId, pregnancyId, s.name, s.severity, s.hours, s.week, s.note,
           String((TEST_USER.current_week - s.week) * 7)]
        );
      }

      // Mood log samples
      const moods = [
        { mood: 'anxious', score: 4,  week: 10, note: 'Worried about first trimester scan' },
        { mood: 'excited', score: 8,  week: 11, note: 'Heard the heartbeat!' },
        { mood: 'tired',   score: 5,  week: 12, note: null },
      ];
      for (const m of moods) {
        await client.query(
          `INSERT INTO mood_logs
             (user_id, pregnancy_id, mood, mood_score, note,
              pregnancy_week, risk_level, logged_at)
           VALUES ($1,$2,$3,$4,$5,$6,'low', now() - ($7 || ' days')::interval)`,
          [userId, pregnancyId, m.mood, m.score, m.note, m.week,
           String((TEST_USER.current_week - m.week) * 7)]
        );
      }

      // Weight log samples (starting weight ~62 kg, gradual gain)
      const weights = [
        { kg: 62.0, week: 8  },
        { kg: 62.3, week: 10 },
        { kg: 62.7, week: 12 },
      ];
      for (const w of weights) {
        await client.query(
          `INSERT INTO weight_logs
             (user_id, pregnancy_id, weight_kg, pregnancy_week, logged_at)
           VALUES ($1,$2,$3,$4, now() - ($5 || ' days')::interval)`,
          [userId, pregnancyId, w.kg, w.week,
           String((TEST_USER.current_week - w.week) * 7)]
        );
      }

      // Appointment samples
      const appointments = [
        {
          title: '12-Week Nuchal Scan', type: 'ultrasound',
          scheduled_at: '2026-06-10 10:00:00+05',
          location_name: 'Aga Khan Hospital Radiology', week: 12,
          notes: 'Fasting not required. Drink water for full bladder.',
        },
        {
          title: 'First Trimester Blood Panel', type: 'blood_test',
          scheduled_at: '2026-06-10 09:00:00+05',
          location_name: 'Aga Khan Hospital Lab', week: 12,
          notes: 'Fasting required from midnight.',
        },
        {
          title: 'Midwife Check-up — Week 16', type: 'midwife',
          scheduled_at: '2026-07-08 11:00:00+05',
          location_name: 'Community Midwifery Clinic', week: 16,
          notes: null,
        },
      ];
      for (const a of appointments) {
        await client.query(
          `INSERT INTO appointments
             (user_id, pregnancy_id, title, type, scheduled_at,
              location_name, pregnancy_week, notes, reminder_minutes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[1440,60]')`,
          [userId, pregnancyId, a.title, a.type, a.scheduled_at,
           a.location_name, a.week, a.notes]
        );
      }

      // Medication reminders
      const medications = [
        { name: 'Folic Acid',      category: 'supplement', dosage: '400 mcg', instructions: 'Take in the morning with breakfast', times: ['08:00'] },
        { name: 'Iron Supplement', category: 'supplement', dosage: '27 mg',   instructions: 'Take on empty stomach with vitamin C', times: ['10:00'] },
        { name: 'Vitamin D3',      category: 'vitamin',    dosage: '1000 IU', instructions: 'Take with a fatty meal',             times: ['13:00'] },
      ];
      for (const m of medications) {
        await client.query(
          `INSERT INTO medication_reminders
             (user_id, pregnancy_id, name, category, dosage, instructions,
              frequency, times_of_day, start_date)
           VALUES ($1,$2,$3,$4,$5,$6,'daily',$7, $8::date)`,
          [userId, pregnancyId, m.name, m.category, m.dosage,
           m.instructions, JSON.stringify(m.times), TEST_USER.lmp_date]
        );
      }

      // Hospital bag — seed template items for this user
      for (const item of HOSPITAL_BAG_TEMPLATE) {
        await client.query(
          `INSERT INTO hospital_bag_items
             (user_id, pregnancy_id, item_name, category, is_essential,
              sort_order, template_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [userId, pregnancyId, item.name, item.category,
           item.is_essential, item.sort_order, item.key]
        );
      }

      // Baby names shortlist
      const names = [
        { name: 'Aiza',   gender_fit: 'girl', origin: 'Arabic',   meaning: 'Noble, honourable',        pronunciation: 'EYE-zah',    syllables: 2, status: 'loved'  },
        { name: 'Zain',   gender_fit: 'boy',  origin: 'Arabic',   meaning: 'Beauty, grace',            pronunciation: 'ZAYN',        syllables: 1, status: 'maybe'  },
        { name: 'Noor',   gender_fit: 'any',  origin: 'Arabic',   meaning: 'Light',                    pronunciation: 'NOOR',        syllables: 1, status: 'loved'  },
        { name: 'Rohan',  gender_fit: 'boy',  origin: 'Sanskrit', meaning: 'Ascending, growing',       pronunciation: 'ROH-han',     syllables: 2, status: 'saved'  },
        { name: 'Zara',   gender_fit: 'girl', origin: 'Arabic',   meaning: 'Blooming flower, princess',pronunciation: 'ZAH-rah',     syllables: 2, status: 'loved'  },
      ];
      for (const n of names) {
        await client.query(
          `INSERT INTO baby_names_shortlist
             (user_id, pregnancy_id, name, gender_fit, origin, meaning,
              pronunciation, syllables, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [userId, pregnancyId, n.name, n.gender_fit, n.origin, n.meaning,
           n.pronunciation, n.syllables, n.status]
        );
      }

      // Conversation + messages (sample chat history)
      const { rows: [conv] } = await client.query(
        `INSERT INTO conversations (user_id, pregnancy_id, mode, title)
         VALUES ($1, $2, 'standard', 'Week 12 questions')
         RETURNING id`,
        [userId, pregnancyId]
      );
      const convId = conv.id;

      const chatHistory = [
        { role: 'user',      content: "I've been feeling really nauseous every morning. Is this normal at 10 weeks?" },
        { role: 'assistant', content: "Morning nausea at 10 weeks is very common — you're right in the peak window (weeks 6–12). Per ACOG guidelines, it affects up to 80% of pregnant people. Small, frequent meals and plain crackers before getting up can help. If you're unable to keep any fluids down, that's worth mentioning to your provider as it could be hyperemesis gravidarum." },
        { role: 'user',      content: 'What foods should I avoid to help with the nausea?' },
        { role: 'assistant', content: 'Great question! Foods that tend to worsen nausea: spicy dishes, fatty or fried food, strong smells (onions, garlic), and caffeine. Try cold foods (they smell less), ginger tea or ginger chews, and vitamin B6-rich foods like bananas and avocado. Eat every 2–3 hours — an empty stomach makes nausea worse.' },
      ];
      for (const msg of chatHistory) {
        await client.query(
          `INSERT INTO messages (conversation_id, user_id, role, content)
           VALUES ($1, $2, $3, $4)`,
          [convId, userId, msg.role, msg.content]
        );
      }
    }

    await client.query('COMMIT');

    console.log('');
    console.log('[seed] ════════════════════════════════════════');
    console.log('[seed] Seed complete ✓');
    console.log(`[seed] Test user: ${TEST_USER.email} / ${TEST_USER.password}`);
    console.log(`[seed] Week: ${TEST_USER.current_week}, Country: ${TEST_USER.country}`);
    console.log('[seed] ════════════════════════════════════════');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] FAILED — rolled back:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
