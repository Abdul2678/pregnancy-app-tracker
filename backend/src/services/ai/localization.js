/**
 * services/ai/localization.js
 * Cultural and medical adaptation layer for international users.
 * Provides country-specific emergency numbers, medical terminology,
 * unit preferences, and content adjustments.
 *
 * Usage:
 *   const { getLocale, adaptContent, getEmergencyNumbers } = require('./localization');
 *
 *   const locale = getLocale('PK');
 *   // locale.emergencyNumber, locale.weightUnit, locale.dateFormat, locale.rtl
 *
 *   const adapted = adaptContent({ text: 'Call 911', countryCode: 'GB' });
 *   // adapted.text: 'Call 999'
 */

'use strict';

// ---------------------------------------------------------------------------
// Country locale data
// ---------------------------------------------------------------------------

/**
 * @typedef {object} CountryLocale
 * @property {string}   emergencyNumber   Primary emergency number
 * @property {string[]} emergencyNumbers  All relevant numbers
 * @property {string}   maternityLine     Specialist maternity/health line if known
 * @property {string}   weightUnit        'kg' | 'lbs'
 * @property {string}   heightUnit        'cm' | 'ft'
 * @property {string}   tempUnit          'celsius' | 'fahrenheit'
 * @property {string}   dateFormat        'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
 * @property {boolean}  rtl               Right-to-left language default
 * @property {string}   currencyCode      ISO 4217
 * @property {string[]} commonLanguages   BCP-47 codes
 * @property {string}   healthSystem      'nhs' | 'universal' | 'insurance' | 'mixed' | 'public'
 * @property {string[]} vaccinationNotes  Country-specific vaccination notes
 */

/** @type {Object.<string, CountryLocale>} */
const COUNTRY_LOCALES = {
  US: {
    emergencyNumber:  '911',
    emergencyNumbers: ['911'],
    maternityLine:    null,
    weightUnit:       'lbs',
    heightUnit:       'ft',
    tempUnit:         'fahrenheit',
    dateFormat:       'MM/DD/YYYY',
    rtl:              false,
    currencyCode:     'USD',
    commonLanguages:  ['en', 'es'],
    healthSystem:     'insurance',
    vaccinationNotes: ['Tdap recommended in 3rd trimester', 'Flu shot recommended'],
  },
  GB: {
    emergencyNumber:  '999',
    emergencyNumbers: ['999', '111'],
    maternityLine:    '111',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'GBP',
    commonLanguages:  ['en'],
    healthSystem:     'nhs',
    vaccinationNotes: ['Whooping cough vaccine offered at 16-32 weeks (NHS)', 'Flu vaccine offered'],
  },
  AU: {
    emergencyNumber:  '000',
    emergencyNumbers: ['000', '112'],
    maternityLine:    '13HEALTH (13 43 25 84)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'AUD',
    commonLanguages:  ['en'],
    healthSystem:     'universal',
    vaccinationNotes: ['Pertussis booster recommended 20-32 weeks', 'Flu vaccine funded'],
  },
  CA: {
    emergencyNumber:  '911',
    emergencyNumbers: ['911', '811'],
    maternityLine:    '811 (HealthLink)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'CAD',
    commonLanguages:  ['en', 'fr'],
    healthSystem:     'universal',
    vaccinationNotes: ['Tdap recommended in each pregnancy', 'Flu vaccine recommended'],
  },
  IN: {
    emergencyNumber:  '112',
    emergencyNumbers: ['112', '108', '102'],
    maternityLine:    '102 (Ambulance)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'INR',
    commonLanguages:  ['hi', 'en', 'ta', 'te', 'mr', 'bn'],
    healthSystem:     'mixed',
    vaccinationNotes: ['Tetanus toxoid (TT) 2 doses during pregnancy (national programme)', 'Iron + folic acid supplementation recommended'],
  },
  PK: {
    emergencyNumber:  '1122',
    emergencyNumbers: ['115', '1122', '16'],
    maternityLine:    '0800-45678 (Health helpline)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'PKR',
    commonLanguages:  ['ur', 'en', 'pa'],
    healthSystem:     'mixed',
    vaccinationNotes: ['Tetanus toxoid (TT) 2 doses standard', 'Iron/folic acid supplementation essential'],
  },
  NG: {
    emergencyNumber:  '199',
    emergencyNumbers: ['199', '112', '767'],
    maternityLine:    null,
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'NGN',
    commonLanguages:  ['en', 'yo', 'ha', 'ig'],
    healthSystem:     'mixed',
    vaccinationNotes: ['Tetanus toxoid (2 doses)', 'IPTp (malaria prevention) for malaria-endemic areas'],
  },
  BR: {
    emergencyNumber:  '192',
    emergencyNumbers: ['192', '190', '193'],
    maternityLine:    '136 (SAMU / health)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'BRL',
    commonLanguages:  ['pt'],
    healthSystem:     'universal',
    vaccinationNotes: ['Diphtheria/tetanus/pertussis vaccine recommended 20th week+', 'Influenza vaccine offered'],
  },
  MX: {
    emergencyNumber:  '911',
    emergencyNumbers: ['911', '065'],
    maternityLine:    '800-00-44-800 (IMSS)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'MXN',
    commonLanguages:  ['es'],
    healthSystem:     'mixed',
    vaccinationNotes: ['Tdap/dTpa recommended in 3rd trimester', 'Flu vaccine recommended'],
  },
  SA: {
    emergencyNumber:  '911',
    emergencyNumbers: ['911', '997'],
    maternityLine:    '920021111 (MOH hotline)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              true,
    currencyCode:     'SAR',
    commonLanguages:  ['ar'],
    healthSystem:     'universal',
    vaccinationNotes: ['Flu and Tdap vaccines recommended'],
  },
  DE: {
    emergencyNumber:  '112',
    emergencyNumbers: ['112', '116117'],
    maternityLine:    '116117 (medical out-of-hours)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD.MM.YYYY',
    rtl:              false,
    currencyCode:     'EUR',
    commonLanguages:  ['de'],
    healthSystem:     'universal',
    vaccinationNotes: ['Pertussis booster during each pregnancy recommended (STIKO)', 'Flu vaccine recommended'],
  },
  FR: {
    emergencyNumber:  '15',
    emergencyNumbers: ['15', '112', '17'],
    maternityLine:    '15 (SAMU)',
    weightUnit:       'kg',
    heightUnit:       'cm',
    tempUnit:         'celsius',
    dateFormat:       'DD/MM/YYYY',
    rtl:              false,
    currencyCode:     'EUR',
    commonLanguages:  ['fr'],
    healthSystem:     'universal',
    vaccinationNotes: ['Tdap recommended each pregnancy', 'Flu vaccine offered'],
  },
};

// Default for unknown countries
const DEFAULT_LOCALE = {
  emergencyNumber:  '112',
  emergencyNumbers: ['112'],
  maternityLine:    null,
  weightUnit:       'kg',
  heightUnit:       'cm',
  tempUnit:         'celsius',
  dateFormat:       'DD/MM/YYYY',
  rtl:              false,
  currencyCode:     'USD',
  commonLanguages:  ['en'],
  healthSystem:     'mixed',
  vaccinationNotes: [],
};

// ---------------------------------------------------------------------------
// Weight/unit conversion helpers
// ---------------------------------------------------------------------------

const KG_TO_LBS = 2.20462;
const CM_TO_FT  = 0.0328084;

/**
 * Converts a weight value to the user's preferred unit.
 * @param {number} kg
 * @param {'kg'|'lbs'} unit
 * @returns {{ value: number, unit: string }}
 */
function formatWeight(kg, unit = 'kg') {
  if (unit === 'lbs') return { value: Math.round(kg * KG_TO_LBS * 10) / 10, unit: 'lbs' };
  return { value: Math.round(kg * 10) / 10, unit: 'kg' };
}

/**
 * Converts a temperature from Celsius to preferred unit.
 * @param {number} celsius
 * @param {'celsius'|'fahrenheit'} unit
 * @returns {{ value: number, unit: string }}
 */
function formatTemp(celsius, unit = 'celsius') {
  if (unit === 'fahrenheit') return { value: Math.round((celsius * 9 / 5 + 32) * 10) / 10, unit: '°F' };
  return { value: celsius, unit: '°C' };
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Returns locale config for a given ISO country code.
 * @param {string} countryCode  ISO 3166-1 alpha-2
 * @returns {CountryLocale}
 */
function getLocale(countryCode) {
  return COUNTRY_LOCALES[(countryCode || '').toUpperCase()] || { ...DEFAULT_LOCALE };
}

/**
 * Returns emergency contact info for display in the app.
 * @param {string} countryCode
 * @returns {{ primary: string, all: string[], maternityLine: string|null }}
 */
function getEmergencyNumbers(countryCode) {
  const locale = getLocale(countryCode);
  return {
    primary:      locale.emergencyNumber,
    all:          locale.emergencyNumbers,
    maternityLine: locale.maternityLine,
  };
}

/**
 * Adapts a text snippet for a specific country (e.g. replaces 911 with local number).
 * Lightweight; for heavy localisation, use the full AI prompt layer.
 *
 * @param {object} opts
 * @param {string} opts.text
 * @param {string} [opts.countryCode]
 * @returns {{ text: string }}
 */
function adaptContent({ text, countryCode }) {
  if (!countryCode || countryCode.toUpperCase() === 'US') return { text };

  const locale = getLocale(countryCode);
  let adapted  = text;

  // Replace US emergency numbers with local equivalents
  adapted = adapted.replace(/\b911\b/g, locale.emergencyNumber);
  adapted = adapted.replace(/\b999\b/g, locale.emergencyNumber);

  return { text: adapted };
}

/**
 * Returns unit preferences for a given country.
 * @param {string} countryCode
 * @returns {{ weight: string, height: string, temp: string, dateFormat: string }}
 */
function getUnitPreferences(countryCode) {
  const locale = getLocale(countryCode);
  return {
    weight:     locale.weightUnit,
    height:     locale.heightUnit,
    temp:       locale.tempUnit,
    dateFormat: locale.dateFormat,
    rtl:        locale.rtl,
  };
}

/**
 * Returns vaccination guidance notes for a country.
 * @param {string} countryCode
 * @returns {string[]}
 */
function getVaccinationNotes(countryCode) {
  return getLocale(countryCode).vaccinationNotes || [];
}

module.exports = {
  getLocale,
  getEmergencyNumbers,
  adaptContent,
  getUnitPreferences,
  getVaccinationNotes,
  formatWeight,
  formatTemp,
  COUNTRY_LOCALES,
};
