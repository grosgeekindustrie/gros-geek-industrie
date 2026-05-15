(function initPipelineUIIcons(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};

  const ICONS = Object.freeze({
    arrowDown: '<path d="M12 5v14"></path><path d="m7 14 5 5 5-5"></path>',
    chevronDown: '<path d="m6 9 6 6 6-6"></path>',
    pin: '<path d="m15 4 5 5-3 1-3 7-2-2 7-3 1-3-5-5z"></path><path d="M6 20l5-5"></path>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="m21 15-4.5-4.5L7 20"></path>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3"></path><path d="M4 4v4h4"></path><path d="M4 13a8 8 0 0 0 14.9 3"></path><path d="M20 20v-4h-4"></path>',
    fastForward: '<path d="m4 6 8 6-8 6V6Z"></path><path d="m12 6 8 6-8 6V6Z"></path>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"></rect>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.27.3.48.65.6 1 .1.32.16.66.17 1.01.01.35-.04.69-.16 1.01a1.7 1.7 0 0 0-.61.98Z"></path>',
    tabletop: '<path d="m12 2 8 4v6c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10V6l8-4Z"></path><path d="m12 2 3 10-3 10-3-10 3-10Z"></path><path d="m4 6 8 6 8-6"></path>',
    collection: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="m7 14 3-3 3 3 4-5 4 5"></path><circle cx="9" cy="8" r="1.5"></circle>',
    coins: '<path d="M12 7c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Z"></path><path d="M4 4v6c0 1.7 3.6 3 8 3s8-1.3 8-3V4"></path><path d="M4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>',
    layers: '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"></path><path d="m3 12 9 4.5 9-4.5"></path><path d="m3 16.5 9 4.5 9-4.5"></path>',
    back: '<path d="m15 18-6-6 6-6"></path><path d="M21 12H9"></path>',
    check: '<path d="m5 12 4 4 10-10"></path>',
    dot: '<circle cx="12" cy="12" r="3"></circle>',
    close: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"></path><path d="M17 21v-8H7v8"></path><path d="M7 3v5h8"></path>',
    alert: '<path d="M12 3 2 21h20L12 3Z"></path><path d="M12 9v5"></path><path d="M12 18h.01"></path>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>',
    externalLink: '<path d="M14 4h6v6"></path><path d="M10 14 20 4"></path><path d="M20 14v6H4V4h6"></path>',
    tag: '<path d="M20.59 13.41 11 23l-8-8V5h10l7.59 7.59a2 2 0 0 1 0 2.82Z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle>',
    target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="1"></circle>',
    play: '<path d="M8 5.14v13.72L19 12 8 5.14Z"></path>',
  });

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderIcon(name, options = {}) {
    const markup = ICONS[name];
    if (!markup) return '';

    const {
      className = '',
      title = '',
      label = '',
      decorative = true,
    } = options;

    const classes = ['ui-icon', className].filter(Boolean).join(' ');
    const titleMarkup = title ? `<title>${escapeHtml(title)}</title>` : '';
    const ariaHidden = decorative && !label ? 'true' : 'false';
    const ariaLabel = label ? ` aria-label="${escapeAttr(label)}"` : '';
    const role = decorative && !label ? '' : ' role="img"';

    return `<span class="${classes}" aria-hidden="${ariaHidden}"><svg viewBox="0 0 24 24"${role}${ariaLabel} focusable="false">${titleMarkup}${markup}</svg></span>`;
  }

  function renderIconLabel(name, label, options = {}) {
    const iconMarkup = renderIcon(name, options);
    if (!label) return iconMarkup;
    return `${iconMarkup}<span class="ui-icon-label">${escapeHtml(label)}</span>`;
  }

  function setIcon(node, name, options = {}) {
    if (!node) return;
    node.innerHTML = renderIcon(name, options);
  }

  function setIconLabel(node, name, label, options = {}) {
    if (!node) return;
    node.innerHTML = renderIconLabel(name, label, options);
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-svg-icon]').forEach((node) => {
      const iconName = node.dataset.svgIcon;
      if (!iconName) return;
      node.innerHTML = renderIcon(iconName, {
        className: node.dataset.svgIconClass || '',
        title: node.dataset.svgTitle || '',
        label: node.dataset.svgLabel || '',
        decorative: node.dataset.svgDecorative !== 'false',
      });
    });
  }

  global.PipelineUIIcons = {
    renderIcon,
    renderIconLabel,
    setIcon,
    setIconLabel,
    hydrateIcons,
  };

  global.PipelineUI.icons = global.PipelineUI.icons || {};
  Object.assign(global.PipelineUI.icons, global.PipelineUIIcons);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => hydrateIcons());
  } else {
    hydrateIcons();
  }
})(window);
