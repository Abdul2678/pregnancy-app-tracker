// db/seed_emergency_resources.js
// Seed emergency resources for 50 countries.
// Run: node src/db/seed_emergency_resources.js

'use strict';

const db = require('./index');

const RESOURCES = [
  // ── Tier 1 — highest user countries ──────────────────────────────────────
  {
    country: 'PK', language: 'en',
    emergency_number: '115',
    ambulance_number: '1122',
    mental_health_line: '0311-7786264',
    resources: [
      { name: 'Edhi Foundation Ambulance', contact: '115', url: 'https://edhi.org', hours: '24/7' },
      { name: 'Umang Mental Health Helpline', contact: '0317-4288665', hours: 'Mon–Sat 9am–1pm' },
      { name: 'Rozan Counselling', contact: '051-2890505', hours: 'Business hours' },
    ],
  },
  {
    country: 'IN', language: 'en',
    emergency_number: '112',
    ambulance_number: '102',
    mental_health_line: 'iCall: 9152987821',
    resources: [
      { name: 'National Emergency Number', contact: '112', hours: '24/7' },
      { name: 'NIMHANS iCall', contact: '9152987821', hours: 'Mon–Sat 8am–10pm' },
      { name: 'Vandrevala Foundation', contact: '1860-2662-345', hours: '24/7' },
    ],
  },
  {
    country: 'NG', language: 'en',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'SOS: 09000000',
    resources: [
      { name: 'National Emergency', contact: '112', hours: '24/7' },
      { name: 'Lagos State Emergency', contact: '767', hours: '24/7' },
      { name: 'Mentally Aware Nigeria', contact: '08090000', hours: 'Business hours' },
    ],
  },
  {
    country: 'BR', language: 'pt',
    emergency_number: '192',
    ambulance_number: '192',
    mental_health_line: 'CVV: 188',
    resources: [
      { name: 'SAMU (Ambulância)', contact: '192', hours: '24/7' },
      { name: 'Bombeiros', contact: '193', hours: '24/7' },
      { name: 'Centro de Valorização da Vida (CVV)', contact: '188', url: 'https://cvv.org.br', hours: '24/7' },
    ],
  },
  {
    country: 'ID', language: 'id',
    emergency_number: '119',
    ambulance_number: '119',
    mental_health_line: 'Into The Light: 119 ext 8',
    resources: [
      { name: 'Nomor Darurat Nasional', contact: '119', hours: '24/7' },
      { name: 'RSJ Hotline', contact: '119 ext 8', hours: '24/7' },
    ],
  },
  {
    country: 'TR', language: 'tr',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'ALO 182',
    resources: [
      { name: 'Acil Yardım', contact: '112', hours: '24/7' },
      { name: 'Kadın Şiddet Hattı', contact: '183', hours: '24/7' },
      { name: 'İntihar Önleme Hattı', contact: '182', hours: '24/7' },
    ],
  },
  {
    country: 'EG', language: 'ar',
    emergency_number: '123',
    ambulance_number: '123',
    mental_health_line: '08008880700',
    resources: [
      { name: 'الطوارئ الوطنية', contact: '123', hours: '24/7' },
      { name: 'خط الدعم النفسي', contact: '08008880700', hours: '24/7' },
    ],
  },
  {
    country: 'SA', language: 'ar',
    emergency_number: '911',
    ambulance_number: '911',
    mental_health_line: '920033360',
    resources: [
      { name: 'الهلال الأحمر', contact: '911', hours: '24/7' },
      { name: 'خط مساندة الصحة النفسية', contact: '920033360', hours: '24/7' },
    ],
  },
  {
    country: 'AE', language: 'ar',
    emergency_number: '999',
    ambulance_number: '998',
    mental_health_line: '800HOPE (4673)',
    resources: [
      { name: 'Emergency & Ambulance', contact: '999', hours: '24/7' },
      { name: 'Dubai Health Authority Mental Health Hotline', contact: '800HOPE', hours: '24/7' },
    ],
  },
  {
    country: 'KE', language: 'sw',
    emergency_number: '999',
    ambulance_number: '0722-207-200',
    mental_health_line: 'Befrienders: 0800 723 253',
    resources: [
      { name: 'Emergency', contact: '999', hours: '24/7' },
      { name: 'St. John Ambulance', contact: '0722-207-200', hours: '24/7' },
      { name: 'Befrienders Kenya', contact: '0800 723 253', hours: '24/7' },
    ],
  },
  {
    country: 'TZ', language: 'sw',
    emergency_number: '112',
    ambulance_number: '114',
    mental_health_line: null,
    resources: [
      { name: 'Emergency', contact: '112', hours: '24/7' },
      { name: 'Ambulance', contact: '114', hours: '24/7' },
    ],
  },

  // ── UK & Europe ──────────────────────────────────────────────────────────
  {
    country: 'GB', language: 'en',
    emergency_number: '999',
    ambulance_number: '999',
    mental_health_line: 'Samaritans: 116 123',
    resources: [
      { name: 'Emergency Services', contact: '999', hours: '24/7' },
      { name: 'NHS 111 (non-emergency)', contact: '111', url: 'https://111.nhs.uk', hours: '24/7' },
      { name: 'Samaritans', contact: '116 123', url: 'https://samaritans.org', hours: '24/7' },
      { name: 'PANDAS (perinatal anxiety/depression)', contact: '0808 1961 776', url: 'https://pandasfoundation.org.uk', hours: '9am–8pm daily' },
    ],
  },
  {
    country: 'DE', language: 'de',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'Telefonseelsorge: 0800 111 0 111',
    resources: [
      { name: 'Notruf', contact: '112', hours: '24/7' },
      { name: 'Telefonseelsorge', contact: '0800 111 0 111', hours: '24/7' },
    ],
  },
  {
    country: 'FR', language: 'fr',
    emergency_number: '15',
    ambulance_number: '15',
    mental_health_line: '3114',
    resources: [
      { name: 'SAMU (urgences médicales)', contact: '15', hours: '24/7' },
      { name: 'Numéro national de prévention du suicide', contact: '3114', hours: '24/7' },
    ],
  },
  {
    country: 'ES', language: 'es',
    emergency_number: '112',
    ambulance_number: '061',
    mental_health_line: 'Teléfono de la Esperanza: 717 003 717',
    resources: [
      { name: 'Emergencias', contact: '112', hours: '24/7' },
      { name: 'Teléfono de la Esperanza', contact: '717 003 717', hours: '24/7' },
    ],
  },
  {
    country: 'IT', language: 'it',
    emergency_number: '118',
    ambulance_number: '118',
    mental_health_line: 'Telefono Amico: 02 2327 2327',
    resources: [
      { name: 'Emergenza / Ambulanza', contact: '118', hours: '24/7' },
      { name: 'Telefono Amico', contact: '02 2327 2327', hours: '24/7' },
    ],
  },
  {
    country: 'NL', language: 'nl',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: '113Online: 0800-0113',
    resources: [
      { name: 'Hulpdiensten', contact: '112', hours: '24/7' },
      { name: '113Online (Suicide Prevention)', contact: '0800-0113', hours: '24/7' },
    ],
  },

  // ── Americas ─────────────────────────────────────────────────────────────
  {
    country: 'US', language: 'en',
    emergency_number: '911',
    ambulance_number: '911',
    mental_health_line: '988 (Suicide & Crisis Lifeline)',
    resources: [
      { name: 'Emergency Services', contact: '911', hours: '24/7' },
      { name: '988 Suicide & Crisis Lifeline', contact: '988', url: 'https://988lifeline.org', hours: '24/7' },
      { name: 'Postpartum Support International', contact: '1-800-944-4773', url: 'https://postpartum.net', hours: 'Mon–Fri 9am–9pm ET' },
    ],
  },
  {
    country: 'CA', language: 'en',
    emergency_number: '911',
    ambulance_number: '911',
    mental_health_line: '1-833-456-4566',
    resources: [
      { name: 'Emergency Services', contact: '911', hours: '24/7' },
      { name: 'Crisis Services Canada', contact: '1-833-456-4566', hours: '24/7' },
    ],
  },
  {
    country: 'MX', language: 'es',
    emergency_number: '911',
    ambulance_number: '911',
    mental_health_line: 'SAPTEL: 55 5259-8121',
    resources: [
      { name: 'Emergencias', contact: '911', hours: '24/7' },
      { name: 'SAPTEL (crisis emocional)', contact: '55 5259-8121', hours: '24/7' },
    ],
  },
  {
    country: 'AR', language: 'es',
    emergency_number: '911',
    ambulance_number: '107',
    mental_health_line: 'Centro de Asistencia al Suicida: 135',
    resources: [
      { name: 'Emergencias', contact: '911', hours: '24/7' },
      { name: 'SAME (ambulancia)', contact: '107', hours: '24/7' },
      { name: 'Centro de Asistencia al Suicida', contact: '135', hours: '24/7' },
    ],
  },
  {
    country: 'CO', language: 'es',
    emergency_number: '123',
    ambulance_number: '123',
    mental_health_line: '106',
    resources: [
      { name: 'Línea de emergencias', contact: '123', hours: '24/7' },
      { name: 'Línea de salud mental', contact: '106', hours: '24/7' },
    ],
  },

  // ── Asia-Pacific ─────────────────────────────────────────────────────────
  {
    country: 'AU', language: 'en',
    emergency_number: '000',
    ambulance_number: '000',
    mental_health_line: 'Lifeline: 13 11 14',
    resources: [
      { name: 'Emergency Services', contact: '000', hours: '24/7' },
      { name: 'Lifeline', contact: '13 11 14', url: 'https://lifeline.org.au', hours: '24/7' },
      { name: 'PANDA (perinatal anxiety/depression)', contact: '1300 726 306', url: 'https://panda.org.au', hours: 'Mon–Sat 9am–7:30pm AEST' },
    ],
  },
  {
    country: 'NZ', language: 'en',
    emergency_number: '111',
    ambulance_number: '111',
    mental_health_line: 'Lifeline: 0800 543 354',
    resources: [
      { name: 'Emergency Services', contact: '111', hours: '24/7' },
      { name: 'Lifeline', contact: '0800 543 354', hours: '24/7' },
    ],
  },
  {
    country: 'PH', language: 'en',
    emergency_number: '911',
    ambulance_number: '161',
    mental_health_line: 'Hopeline: 2919',
    resources: [
      { name: 'National Emergency Hotline', contact: '911', hours: '24/7' },
      { name: 'NDRRMC', contact: '161', hours: '24/7' },
      { name: 'Hopeline Philippines', contact: '2919', hours: '24/7' },
    ],
  },
  {
    country: 'BD', language: 'en',
    emergency_number: '999',
    ambulance_number: '999',
    mental_health_line: 'Kaan Pete Roi: 01779-554391',
    resources: [
      { name: 'National Emergency Service', contact: '999', hours: '24/7' },
      { name: 'Kaan Pete Roi', contact: '01779-554391', hours: '6pm–10pm daily' },
    ],
  },
  {
    country: 'MY', language: 'en',
    emergency_number: '999',
    ambulance_number: '999',
    mental_health_line: 'Befrienders KL: 03-76272929',
    resources: [
      { name: 'Emergency', contact: '999', hours: '24/7' },
      { name: 'Befrienders Kuala Lumpur', contact: '03-76272929', hours: '24/7' },
    ],
  },
  {
    country: 'SG', language: 'en',
    emergency_number: '995',
    ambulance_number: '995',
    mental_health_line: 'SOS: 1767',
    resources: [
      { name: 'Emergency / Ambulance', contact: '995', hours: '24/7' },
      { name: 'Samaritans of Singapore', contact: '1767', url: 'https://sos.org.sg', hours: '24/7' },
    ],
  },
  {
    country: 'JP', language: 'en',
    emergency_number: '119',
    ambulance_number: '119',
    mental_health_line: 'Inochi no Denwa: 0570-783-556',
    resources: [
      { name: '救急 (Emergency / Ambulance)', contact: '119', hours: '24/7' },
      { name: 'Inochi no Denwa', contact: '0570-783-556', hours: '24/7' },
    ],
  },
  {
    country: 'KR', language: 'en',
    emergency_number: '119',
    ambulance_number: '119',
    mental_health_line: 'Suicide Prevention: 1393',
    resources: [
      { name: 'Emergency / Ambulance', contact: '119', hours: '24/7' },
      { name: 'Korea Suicide Prevention Hotline', contact: '1393', hours: '24/7' },
    ],
  },
  {
    country: 'CN', language: 'en',
    emergency_number: '120',
    ambulance_number: '120',
    mental_health_line: 'Beijing: 010-82951332',
    resources: [
      { name: '急救 (Ambulance)', contact: '120', hours: '24/7' },
      { name: 'Beijing Suicide Research Centre', contact: '010-82951332', hours: '24/7' },
    ],
  },

  // ── Africa ───────────────────────────────────────────────────────────────
  {
    country: 'ZA', language: 'en',
    emergency_number: '10177',
    ambulance_number: '10177',
    mental_health_line: 'SADAG: 0800 456 789',
    resources: [
      { name: 'Emergency Services', contact: '10177', hours: '24/7' },
      { name: 'SADAG Mental Health Line', contact: '0800 456 789', url: 'https://sadag.org', hours: '24/7' },
      { name: 'MomConnect (maternal health SMS)', contact: '134', hours: '24/7' },
    ],
  },
  {
    country: 'GH', language: 'en',
    emergency_number: '112',
    ambulance_number: '193',
    mental_health_line: null,
    resources: [
      { name: 'National Emergency', contact: '112', hours: '24/7' },
      { name: 'Ambulance Service', contact: '193', hours: '24/7' },
    ],
  },
  {
    country: 'ET', language: 'en',
    emergency_number: '911',
    ambulance_number: '907',
    mental_health_line: null,
    resources: [
      { name: 'Emergency', contact: '911', hours: '24/7' },
      { name: 'Ambulance', contact: '907', hours: '24/7' },
    ],
  },
  {
    country: 'MA', language: 'ar',
    emergency_number: '150',
    ambulance_number: '15',
    mental_health_line: null,
    resources: [
      { name: 'الأمن الوطني', contact: '190', hours: '24/7' },
      { name: 'الإسعاف', contact: '15', hours: '24/7' },
    ],
  },

  // ── Middle East (additional) ──────────────────────────────────────────────
  {
    country: 'JO', language: 'ar',
    emergency_number: '911',
    ambulance_number: '911',
    mental_health_line: null,
    resources: [
      { name: 'الطوارئ', contact: '911', hours: '24/7' },
    ],
  },
  {
    country: 'IQ', language: 'ar',
    emergency_number: '122',
    ambulance_number: '115',
    mental_health_line: null,
    resources: [
      { name: 'الشرطة', contact: '104', hours: '24/7' },
      { name: 'الإسعاف', contact: '115', hours: '24/7' },
    ],
  },

  // ── Additional global ─────────────────────────────────────────────────────
  {
    country: 'RU', language: 'en',
    emergency_number: '112',
    ambulance_number: '103',
    mental_health_line: '8-800-2000-122',
    resources: [
      { name: 'Emergency', contact: '112', hours: '24/7' },
      { name: 'Ambulance', contact: '103', hours: '24/7' },
      { name: 'Helpline for children & families', contact: '8-800-2000-122', hours: '24/7' },
    ],
  },
  {
    country: 'UA', language: 'en',
    emergency_number: '112',
    ambulance_number: '103',
    mental_health_line: null,
    resources: [
      { name: 'Emergency', contact: '112', hours: '24/7' },
    ],
  },
  {
    country: 'PL', language: 'en',
    emergency_number: '112',
    ambulance_number: '999',
    mental_health_line: 'Telefon Zaufania: 116 123',
    resources: [
      { name: 'Nagłe przypadki', contact: '112', hours: '24/7' },
      { name: 'Telefon Zaufania dla Dorosłych', contact: '116 123', hours: '24/7' },
    ],
  },
  {
    country: 'PT', language: 'pt',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'SOS Voz Amiga: 213 544 545',
    resources: [
      { name: 'Emergências', contact: '112', hours: '24/7' },
      { name: 'SOS Voz Amiga', contact: '213 544 545', hours: '15:30–0:30 daily' },
    ],
  },
  {
    country: 'SE', language: 'en',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'Mind: 90101',
    resources: [
      { name: 'Nödnummer', contact: '112', hours: '24/7' },
      { name: 'Mind Självmordslinjen', contact: '90101', hours: '24/7' },
    ],
  },
  {
    country: 'NO', language: 'en',
    emergency_number: '113',
    ambulance_number: '113',
    mental_health_line: 'Kirkens SOS: 22 40 00 40',
    resources: [
      { name: 'Medisinsk nødnummer', contact: '113', hours: '24/7' },
      { name: 'Kirkens SOS', contact: '22 40 00 40', hours: '24/7' },
    ],
  },
  {
    country: 'DK', language: 'en',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'Livslinien: 70201201',
    resources: [
      { name: 'Alarmcentralen', contact: '112', hours: '24/7' },
      { name: 'Livslinien', contact: '70201201', hours: '11am–5pm Mon–Fri' },
    ],
  },
  {
    country: 'FI', language: 'en',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'MIELI: 09 2525 0111',
    resources: [
      { name: 'Hätänumero', contact: '112', hours: '24/7' },
      { name: 'MIELI Mental Health Finland', contact: '09 2525 0111', hours: '24/7' },
    ],
  },
  {
    country: 'CH', language: 'en',
    emergency_number: '144',
    ambulance_number: '144',
    mental_health_line: 'Die Dargebotene Hand: 143',
    resources: [
      { name: 'Sanitätsnotruf', contact: '144', hours: '24/7' },
      { name: 'Die Dargebotene Hand', contact: '143', hours: '24/7' },
    ],
  },
  {
    country: 'AT', language: 'en',
    emergency_number: '144',
    ambulance_number: '144',
    mental_health_line: 'Telefonseelsorge: 142',
    resources: [
      { name: 'Rettung (Ambulance)', contact: '144', hours: '24/7' },
      { name: 'Telefonseelsorge Österreich', contact: '142', hours: '24/7' },
    ],
  },
  {
    country: 'BE', language: 'en',
    emergency_number: '112',
    ambulance_number: '112',
    mental_health_line: 'Tele-Onthaal: 106',
    resources: [
      { name: 'Emergency / Ambulance', contact: '112', hours: '24/7' },
      { name: 'Tele-Onthaal', contact: '106', hours: '24/7' },
    ],
  },
  {
    country: 'CL', language: 'es',
    emergency_number: '131',
    ambulance_number: '131',
    mental_health_line: 'Fono Orientación: 600 360 7777',
    resources: [
      { name: 'SAMU (Ambulancia)', contact: '131', hours: '24/7' },
      { name: 'Salud Responde', contact: '600 360 7777', hours: '24/7' },
    ],
  },
  {
    country: 'PE', language: 'es',
    emergency_number: '116',
    ambulance_number: '116',
    mental_health_line: 'MINSA: 113',
    resources: [
      { name: 'SAMU', contact: '106', hours: '24/7' },
      { name: 'MINSA Salud Mental', contact: '113', hours: '24/7' },
    ],
  },
];

async function seed() {
  console.log(`Seeding emergency resources for ${RESOURCES.length} countries…`);
  let upserted = 0;
  let errors   = 0;

  for (const row of RESOURCES) {
    try {
      await db.query(
        `INSERT INTO emergency_resources
           (country, language, emergency_number, ambulance_number, mental_health_line, resources, last_verified_at)
         VALUES ($1,$2,$3,$4,$5,$6, CURRENT_DATE)
         ON CONFLICT (country, language) DO UPDATE SET
           emergency_number   = EXCLUDED.emergency_number,
           ambulance_number   = EXCLUDED.ambulance_number,
           mental_health_line = EXCLUDED.mental_health_line,
           resources          = EXCLUDED.resources,
           last_verified_at   = CURRENT_DATE,
           updated_at         = now()`,
        [
          row.country,
          row.language,
          row.emergency_number,
          row.ambulance_number ?? null,
          row.mental_health_line ?? null,
          JSON.stringify(row.resources),
        ]
      );
      upserted++;
    } catch (err) {
      console.error(`  Error for ${row.country}:`, err.message);
      errors++;
    }
  }

  console.log(`Done. Upserted: ${upserted}, Errors: ${errors}`);
  await db.end?.();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
