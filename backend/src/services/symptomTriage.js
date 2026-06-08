// services/symptomTriage.js
// Thin wrapper — delegates to the full AI service implementation.
// Kept for backwards compatibility with routes that import from this path.

const { triageSymptom } = require('./ai/symptomTriage');

module.exports = { triageSymptom };
