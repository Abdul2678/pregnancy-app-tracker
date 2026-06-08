// services/weeklyContent.js
// Thin wrapper — delegates to the full AI service implementation.
// Kept for backwards compatibility with routes that import from this path.

const { getWeekContent, generateAllWeeks } = require('./ai/weekContent');

module.exports = { getWeekContent, generateAllWeeks };
