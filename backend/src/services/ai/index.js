/**
 * services/ai/index.js
 * Barrel export for all AI services.
 *
 * Usage:
 *   const { triageSymptom, assessMentalHealth, getDailyTip } = require('./services/ai');
 */

'use strict';

module.exports = {
  ...require('./systemPrompt'),
  ...require('./onboarding'),
  ...require('./symptomTriage'),
  ...require('./mentalHealth'),
  ...require('./dailyTip'),
  ...require('./weekContent'),
  ...require('./contractionAnalyzer'),
  ...require('./birthPlan'),
  ...require('./localization'),
};
