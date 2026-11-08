'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const loadRuntime = (relativePath, app) => {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  vm.runInNewContext(source, { window: app });
};

test('GPT-6 built-in profiles route Sol and preserve reasoning levels', () => {
  const app = { PipelineUI: {}, localStorage: { getItem: () => null, setItem: () => {} } };
  loadRuntime('src/js/shared/ai/ai_profiles.js', app);
  const profiles = app.PipelineUIAIProfiles;
  const uniform = profiles.getProfileForId(profiles.PROFILE_IDS.OPENAI_6_STANDARD);
  const custom = profiles.getProfileForId(profiles.PROFILE_IDS.OPENAI_6_CUSTOM);

  assert.equal(uniform.baseModel, 'gpt-6-sol');
  assert.equal(uniform.descriptionResearch.model, 'gpt-6-sol');
  assert.equal(uniform.descriptionResearch.reasoningEffort, 'low');
  assert.equal(profiles.resolveExecution('description', { profile: uniform }).model, 'gpt-6-sol');
  const uniformLuna = profiles.normalizeConfig({ ...uniform, baseModel: 'gpt-6-luna' });
  assert.equal(profiles.resolveExecution('title', { profile: uniformLuna }).model, 'gpt-6-luna');
  assert.equal(profiles.resolveExecution('description', { profile: uniformLuna }).model, 'gpt-6-luna');
  assert.equal(custom.routes.description, 'gpt-6-sol');
  assert.equal(profiles.normalizeOpenAIModel('gpt-6-luna'), 'gpt-6-luna');
  assert.deepEqual(Array.from(profiles.getReasoningEffortsForModel('gpt-6-sol'), ({ value }) => value),
    ['none', 'low', 'medium', 'high', 'xhigh', 'max']);

  const edited = profiles.normalizeConfig({ ...custom, routes: { ...custom.routes, description: 'gpt-6-luna' },
    reasoningEfforts: { ...custom.reasoningEfforts, description: 'high' } });
  assert.equal(profiles.resolveExecution('description', { profile: edited }).model, 'gpt-6-luna');
  assert.equal(profiles.resolveExecution('description', { profile: edited }).reasoningEffort, 'high');
});

test('cost ledger uses GPT-6 prices and long-context multipliers', () => {
  const app = { PipelineUI: {}, AGENT_MODELS: {} };
  loadRuntime('src/js/pipeline/runtime/cost_runtime_ui.js', app);
  const { getCostRatesForAgent, buildUsageCostSnapshot } = app.PipelineUICostRuntime;
  const perMillion = (model, rawInputTokens = 10000) => {
    const rates = getCostRatesForAgent('description', model, 'openai', rawInputTokens);
    return [rates.input, rates.cacheWrite, rates.cacheRead, rates.output].map((rate) => rate * 1_000_000);
  };

  assert.deepEqual(perMillion('gpt-6-sol'), [2, 2.5, 0.2, 10]);
  assert.deepEqual(perMillion('gpt-6-luna'), [0.1, 0.125, 0.01, 0.5]);
  assert.deepEqual(perMillion('gpt-5.6-sol'), [4, 5, 0.4, 20]);
  assert.deepEqual(perMillion('gpt-5.6-terra'), [2, 2.5, 0.2, 12]);
  assert.deepEqual(perMillion('gpt-5.6-luna'), [0.2, 0.25, 0.02, 1.2]);
  assert.deepEqual(perMillion('gpt-6-sol', 272001), [4, 5, 0.4, 15]);
  assert.deepEqual(perMillion('gpt-6-luna', 272001), [0.2, 0.25, 0.02, 0.75]);

  const snapshot = buildUsageCostSnapshot('description', {
    input_tokens: 10000, output_tokens: 2000, raw_input_tokens: 10000, web_search_calls: 1,
  }, { provider: 'openai', model: 'gpt-6-sol' });
  assert.equal(snapshot.costCents, 5);
  assert.equal(snapshot.webSearchCostCents, 1);
});
