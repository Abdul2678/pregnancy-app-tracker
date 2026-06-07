// test/prompts.test.js
// Smoke tests for prompt builders and safety logic (no network, no DB).

const test = require('node:test');
const assert = require('node:assert');

const { buildSystemPrompt } = require('../src/prompts/systemPrompt');
const { buildOnboardingPrompt } = require('../src/prompts/onboardingPrompt');
const { buildSymptomTriagePrompt } = require('../src/prompts/symptomTriagePrompt');
const { containsEmergencyKeyword, EMERGENCY_RESPONSE } = require('../src/services/session');

test('buildSystemPrompt includes the current week', () => {
  const prompt = buildSystemPrompt({ currentWeek: 12, language: 'English' });
  assert.match(prompt, /week: 12/);
});

test('buildSystemPrompt switches to partner prompt', () => {
  const prompt = buildSystemPrompt({ partnerMode: true });
  assert.match(prompt, /partners and family members/);
});

test('buildOnboardingPrompt returns system and user strings', () => {
  const { system, user } = buildOnboardingPrompt({ dateInput: '2026-01-01', dateType: 'lmp' });
  assert.ok(system.length > 0);
  assert.match(user, /calculatedDueDate/);
});

test('buildSymptomTriagePrompt embeds the symptom text', () => {
  const { user } = buildSymptomTriagePrompt({ symptomText: 'headache', severity: 3 });
  assert.match(user, /headache/);
});

test('emergency keyword detection short-circuits', () => {
  assert.equal(containsEmergencyKeyword('I have severe pain'), true);
  assert.equal(containsEmergencyKeyword('feeling great today'), false);
  assert.ok(EMERGENCY_RESPONSE.includes('emergency'));
});
