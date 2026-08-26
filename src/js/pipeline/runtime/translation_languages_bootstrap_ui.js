'use strict';

(function initTranslationLanguagePanels() {
  const languages = Object.freeze([
    { code: 'it', label: 'IT', adjective: 'italienne' },
    { code: 'nl', label: 'NL', adjective: 'néerlandaise' },
    { code: 'pt', label: 'PT', adjective: 'portugaise' },
  ]);

  function adaptClone(root, language) {
    [root, ...root.querySelectorAll('*')].forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const value = attribute.value
          .replaceAll('translation-es', `translation-${language.code}`)
          .replaceAll('traduction_listing_es', `traduction_listing_${language.code}`)
          .replaceAll('traduction_es', `traduction_${language.code}`);
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      node.nodeValue = String(node.nodeValue || '')
        .replaceAll('traduction_listing_es', `traduction_listing_${language.code}`)
        .replaceAll('traduction_es', `traduction_${language.code}`)
        .replaceAll('espagnole', language.adjective)
        .replaceAll('espagnol', language.adjective.replace(/e$/, ''))
        .replace(/\bES\b/g, language.label);
    }
  }

  ['tt', 'col'].forEach((prefix) => {
    const sourceTab = document.getElementById(`${prefix}-translation-subtab-es`);
    const sourcePanel = document.getElementById(`${prefix}-translation-subpanel-es`);
    if (!sourceTab || !sourcePanel) return;

    let tabCursor = sourceTab;
    let panelCursor = sourcePanel;
    languages.forEach((language) => {
      const tab = sourceTab.cloneNode(true);
      tab.id = `${prefix}-translation-subtab-${language.code}`;
      tab.textContent = language.label;
      tab.classList.remove('is-active', 'is-running', 'is-success', 'is-error');
      tab.setAttribute('aria-selected', 'false');
      tabCursor.after(tab);
      tabCursor = tab;

      const panel = sourcePanel.cloneNode(true);
      adaptClone(panel, language);
      panel.id = `${prefix}-translation-subpanel-${language.code}`;
      panel.classList.remove('is-active');
      panel.hidden = true;
      panelCursor.after(panel);
      panelCursor = panel;
    });
  });
})();
