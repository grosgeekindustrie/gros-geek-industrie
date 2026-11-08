'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

for (const shop of ['grosgeek', 'doublex']) {
  for (const mode of ['tabletop', 'collection']) {
    test(`${shop} ${mode}: actual GPT prompt runs research before writing`, async () => {
      const calls = [];
      const app = {
        currentMode: mode,
        state: { images: { test: [{ base64: 'image', mediaType: 'image/png' }] } },
        callOpenAI: async (id, request) => {
          calls.push({ id, request });
          return { text: 'Verified research brief', sources: [], usage: {} };
        },
      };
      const localStorage = { getItem: () => JSON.stringify({ activeShop: shop }) };
      app.localStorage = localStorage;
      const context = vm.createContext({ window: app, localStorage });
      const root = path.join(__dirname, '..');
      for (const file of [
        'src/js/shared/ai/ai_profiles.js',
        'src/js/shared/ai/prompt_profiles.js',
        'src/js/pipeline/data/prompt_maps_data.js',
        'src/js/pipeline/runtime/description_research_runtime_ui.js',
      ]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);

      const runtime = app.PipelineUIDescriptionResearchRuntime;
      const profile = app.PipelineUIAIProfiles.normalizeConfig({ id: 'openai-6-standard' });
      const source = runtime.resolveDescriptionPromptSource(profile);
      assert.equal(source.shopKey, shop);
      assert.equal(source.mode, mode);
      const filled = fs.readFileSync(path.join(root, source.path), 'utf8');
      const phases = runtime.parseDescriptionPromptPhases(filled);
      assert.equal(phases.hasExplicitPhases, true, source.path);
      const result = await runtime.prepareDescriptionPrompt({
        prefix: 'test', prompt: { filled }, aiProfileSnapshot: profile,
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].id, 'description_research');
      assert.equal(calls[0].request.responsesOptions.tools[0].type, 'web_search');
      assert.ok(calls[0].request.filled.includes(phases.common));
      assert.ok(calls[0].request.filled.includes(phases.research));
      assert.ok(!calls[0].request.filled.includes(phases.writing));
      assert.ok(result.prompt.filled.includes(phases.writing));
      assert.ok(!result.prompt.filled.includes(phases.research));
      assert.ok(result.prompt.filled.includes('Verified research brief'));
    });
  }
}

test('Description reuses web research until a full pipeline clears it', async () => {
  const calls = [];
  const app = {
    PipelineUI: {},
    currentMode: 'collection',
    state: { images: { col: [{ name: 'first.png', base64: 'first', mediaType: 'image/png' }] } },
    PipelineUIAIProfiles: {
      normalizeConfig: (profile) => profile,
      normalizeDescriptionResearch: (config) => config,
      getProfileLabel: () => 'Test',
    },
    callOpenAI: async (...args) => {
      calls.push(args);
      return { text: `brief ${calls.length}`, sources: [], usage: { web_search_calls: 1 } };
    },
    showAgentCost: () => {},
    showToast: () => {},
    persistPipelineRuntimeState: () => {},
  };
  const storage = { getItem: () => '{}' };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/js/pipeline/runtime/description_research_runtime_ui.js'), 'utf8');
  vm.runInNewContext(source, { window: app, localStorage: storage });
  const runtime = app.PipelineUIDescriptionResearchRuntime;
  const profile = { provider: 'openai', id: 'test', descriptionResearch: {
    enabled: true, reuseIdentical: true, model: 'test', reasoningEffort: 'low',
    maxToolCalls: 1, searchContextSize: 'low',
  } };
  const prompt = (subject) => ({ filled: [
    '<!-- GGI_DESCRIPTION_COMMON_START -->', subject, '<!-- GGI_DESCRIPTION_COMMON_END -->',
    '<!-- GGI_DESCRIPTION_RESEARCH_START -->', 'Search', '<!-- GGI_DESCRIPTION_RESEARCH_END -->',
    '<!-- GGI_DESCRIPTION_WRITING_START -->', 'Write', '<!-- GGI_DESCRIPTION_WRITING_END -->',
  ].join('\n') });

  const first = await runtime.prepareDescriptionPrompt({ prefix: 'col', prompt: prompt('first'), aiProfileSnapshot: profile });
  assert.equal(calls.length, 1);
  assert.match(first.prompt.filled, /brief 1/);

  app.state.images.col = [{ name: 'second.png', base64: 'second', mediaType: 'image/png' }];
  const rerun = await runtime.prepareDescriptionPrompt({ prefix: 'col', prompt: prompt('changed'), aiProfileSnapshot: profile });
  assert.equal(calls.length, 1);
  assert.equal(rerun.research.reused, true);
  assert.match(rerun.prompt.filled, /changed/);
  assert.match(rerun.prompt.filled, /brief 1/);

  runtime.clearDescriptionResearchCache('col');
  const newPipeline = await runtime.prepareDescriptionPrompt({ prefix: 'col', prompt: prompt('changed'), aiProfileSnapshot: profile });
  assert.equal(calls.length, 2);
  assert.match(newPipeline.prompt.filled, /brief 2/);
});
