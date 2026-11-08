'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'js', 'app', 'shell', 'communication_ui.js'),
  'utf8',
);
const host = { innerHTML: '' };
let shop = 'grosgeek';
const storage = {
  'pipeline.communication.v1': JSON.stringify({
    screen: 'editor',
    templateId: 'phone',
    includeSister: true,
    drafts: {
      'phone:fr': 'Gros Geek Industrie possède également une boutique sœur : DOUBLE X Industry.\n\nRetouche personnelle Gros Geek\n\nhttps://doublexindustrie.etsy.com',
      'doublex:phone:fr': 'DOUBLE X Industry est la boutique sœur de Gros Geek Industrie.\n\nRetouche personnelle DOUBLE X\n\nhttps://grosgeekindustrie.etsy.com',
    },
  }),
};
const window = {
  PipelineUIApp: { getActiveShopKey: () => shop },
};
vm.runInNewContext(script, {
  window,
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
  },
  document: { getElementById: () => host },
});

const languages = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt', 'ja', 'pl', 'ru', 'sv'];
for (const language of languages) {
  shop = 'grosgeek';
  const grosgeek = window.PipelineUICommunication.buildMessage(language);
  assert.ok(grosgeek.includes('https://doublexindustrie.etsy.com'), language);
  assert.ok(!grosgeek.includes('https://grosgeekindustrie.etsy.com'), language);

  shop = 'doublex';
  const doublex = window.PipelineUICommunication.buildMessage(language);
  assert.ok(doublex.includes('https://grosgeekindustrie.etsy.com'), language);
  assert.ok(!doublex.includes('https://doublexindustrie.etsy.com'), language);
  assert.ok(doublex.includes('Gros Geek Industrie'), language);
}

shop = 'doublex';
window.PipelineUICommunication.render();
assert.ok(!host.innerHTML.includes('Retouche personnelle Gros Geek'));
assert.ok(host.innerHTML.includes('https://grosgeekindustrie.etsy.com'));
assert.ok(host.innerHTML.includes('c’est la grande sœur de DOUBLE X Industry'));
assert.ok(host.innerHTML.includes('Retouche personnelle DOUBLE X'));
assert.ok(!host.innerHTML.includes('DOUBLE X Industry est la boutique sœur de Gros Geek Industrie.'));

shop = 'grosgeek';
window.PipelineUICommunication.render();
assert.ok(host.innerHTML.includes('c’est la petite sœur de Gros Geek Industrie'));
assert.ok(host.innerHTML.includes('Retouche personnelle Gros Geek'));
assert.ok(!host.innerHTML.includes('Gros Geek Industrie possède également une boutique sœur'));

process.stdout.write('Communication: 11 langues et brouillons par boutique vérifiés.\n');
