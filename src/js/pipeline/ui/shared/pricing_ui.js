'use strict';

// Pricing figurine contextuel au produit courant.
// Le module lit exclusivement les echelles selectionnees dans PipelineUIEchelles
// et reste volontairement hors du contexte transmis aux agents IA.
(function initPipelineUIPricing(global) {
  global.PipelineUI = global.PipelineUI || {};

  const PREFIXES = ['tt', 'col'];
  const RATE_STORAGE_KEY = 'figurineUsdToEurRate';
  const RATE_DATE_STORAGE_KEY = 'figurineUsdToEurRateDate';
  const DEFAULT_RATE = 0.8559;
  const MAX_USD_NOMINAL = 500;
  const stateByPrefix = new Map();
  let toastTimer = null;

  const createDefaultCalculator = () => ({
    resinCost: '',
    supportVariable: '1.4',
    finalMultiplier: '10',
    plates: '1',
    tax: '1',
    total: 0,
  });

  const getState = (prefix) => {
    if (!stateByPrefix.has(prefix)) {
      stateByPrefix.set(prefix, {
        calculator: createDefaultCalculator(),
        rows: {},
      });
    }
    return stateByPrefix.get(prefix);
  };

  const readNumber = (value) => {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : NaN;
  };

  const euro = (value) => new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const usd = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const plainEuro = (value) => Number(value || 0).toFixed(2).replace('.', ',');
  const normalizeManualFrPrice = (value) => {
    const price = readNumber(value);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price)) return String(value ?? '');
    return (price - 0.01).toFixed(2);
  };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getRate = () => {
    const saved = Number(localStorage.getItem(RATE_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_RATE;
  };

  const usdPricePoint = (nominalStep) => Math.max(0.99, nominalStep - 0.01);

  // Logique V7 conservee : palier inferieur, proche ou superieur selon la tranche FR.
  const suggestedUsdFromEuro = (frPrice, rate) => {
    if (!Number.isFinite(frPrice) || frPrice <= 0 || !Number.isFinite(rate) || rate <= 0) {
      return { target: 0, mode: 'none' };
    }

    const raw = frPrice / rate;
    const points = [];
    for (let nominal = 5; nominal <= MAX_USD_NOMINAL; nominal += 5) points.push(usdPricePoint(nominal));

    let target;
    let mode;
    if (frPrice < 100) {
      target = points[0];
      for (const point of points) {
        if (point <= raw) target = point;
        else break;
      }
      mode = 'acquisition';
    } else if (frPrice < 200) {
      target = points.reduce((best, point) => (
        Math.abs(point - raw) < Math.abs(best - raw) ? point : best
      ), points[0]);
      mode = 'standard';
    } else {
      target = points[points.length - 1];
      for (const point of points) {
        if (point >= raw) {
          target = point;
          break;
        }
      }
      mode = 'premium';
    }

    return { target, mode };
  };

  const buildShell = (prefix) => `
    <div class="pricing-stack">
      <section class="pricing-panel pricing-cost-panel">
        <div class="pricing-section-heading">
          <div>
            <span class="pricing-eyebrow">CALCULATEUR DE COÛT</span>
            <h2>Prix conseillé de l’échelle d’origine</h2>
            <p>Logique V7 inchangée : résine, support, multiplicateur, plateaux et taxe.</p>
          </div>
          <span class="pricing-version">V7</span>
        </div>
        <div class="pricing-cost-layout">
          <form class="pricing-calculator-form" data-pricing-calculator="${prefix}" novalidate>
            <div class="pricing-form-grid">
              <label>Coût en résine (€)<input data-calc-field="resinCost" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Ex : 10"><small>Coût matière de base.</small></label>
              <label>Variable de support<input data-calc-field="supportVariable" type="number" min="0" step="0.1" inputmode="decimal"><small>Par défaut : 1,4.</small></label>
              <label>Multiplicateur final<select data-calc-field="finalMultiplier">${Array.from({ length: 6 }, (_, index) => 10 - index).map((value) => `<option value="${value}">× ${value}</option>`).join('')}</select><small>De 10 à 5.</small></label>
              <label>Nombre de plateaux<select data-calc-field="plates">${Array.from({ length: 12 }, (_, index) => index + 1).map((value) => `<option value="${value}">${value === 1 ? '1 plateau' : `${value} plateaux`}</option>`).join('')}</select><small>De 1 à 12 plateaux.</small></label>
              <label>Taxe / diviseur<input data-calc-field="tax" type="number" min="0.05" step="0.05" inputmode="decimal"><small>1 = aucune taxe. 0,8 = 20 %.</small></label>
            </div>
            <div class="pricing-actions">
              <button class="btn btn-accent" type="submit">Calculer</button>
              <button class="btn btn-muted" type="button" data-pricing-reset>Réinitialiser</button>
            </div>
            <p class="pricing-error" data-pricing-error aria-live="polite"></p>
          </form>
          <div class="pricing-cost-result" aria-live="polite">
            <span>Prix conseillé</span>
            <strong data-cost-total>0,00 €</strong>
            <p data-cost-formula>Base : coût résine × variable de support × multiplicateur final. Taxe appliquée sur le total, malus inclus.</p>
            <button class="btn btn-accent" type="button" data-pricing-transfer-origin disabled>Transférer vers l’échelle d’origine</button>
            <dl class="pricing-breakdown">
              <div><dt>Résine × support</dt><dd data-cost-support>0,00 €</dd></div>
              <div><dt>Base avant taxe</dt><dd data-cost-base>0,00 €</dd></div>
              <div><dt>Total avant taxe</dt><dd data-cost-subtotal>0,00 €</dd></div>
              <div><dt>Plateaux supplémentaires</dt><dd data-cost-extra>0</dd></div>
              <div><dt>Malus plateaux</dt><dd data-cost-penalty>0,00 €</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section class="pricing-panel pricing-us-panel">
        <div class="pricing-section-heading pricing-us-heading">
          <div>
            <span class="pricing-eyebrow">PRICING USA ETSY</span>
            <h2>Positionnement par échelle</h2>
            <p>Les lignes suivent automatiquement les échelles sélectionnées dans le formulaire.</p>
          </div>
          <div class="pricing-rate-box">
            <label>Taux USD → EUR<input data-usd-rate type="number" min="0.000001" step="0.000001" inputmode="decimal"></label>
            <span>EUR pour 1 USD</span>
            <button class="btn btn-muted" type="button" data-check-rate>↻ Vérifier le taux BCE</button>
            <small data-rate-status>Taux manuel actuel. Vérification à la demande.</small>
          </div>
        </div>
        <div class="pricing-recommendation" data-pricing-recommendation>
          <div class="pricing-recommendation-head">
            <div>
              <span class="pricing-eyebrow">RECOMMANDATION USA</span>
              <h3>Positionnement de l’échelle d’origine</h3>
            </div>
            <span class="pricing-strategy-badge" data-recommendation-strategy>En attente d’un prix</span>
          </div>
          <div class="pricing-recommendation-metrics">
            <div><span>Conversion brute</span><strong data-recommendation-raw>—</strong></div>
            <div class="is-highlight"><span>Prix US conseillé</span><strong data-recommendation-us>—</strong></div>
            <button type="button" data-recommendation-copy disabled><span>EUR à saisir dans Etsy</span><strong data-recommendation-eur>—</strong></button>
          </div>
          <p>Jusqu’à 100 €, palier .99 inférieur. Entre 100 € et 200 €, palier le plus proche. À partir de 200 €, palier supérieur.</p>
        </div>
        <div class="pricing-table-wrap">
          <table class="pricing-scale-table">
            <thead><tr><th>Scale</th><th>Prix FR</th><th>US sans compensation</th><th>Compensation logistique</th><th>US final client</th><th>EUR à saisir dans Etsy</th></tr></thead>
            <tbody data-pricing-scale-body></tbody>
          </table>
          <p class="pricing-empty" data-pricing-empty>Sélectionne au moins une échelle dans l’étape précédente.</p>
        </div>
      </section>

      <section class="pricing-panel pricing-reference-panel">
        <div class="pricing-section-heading pricing-reference-heading">
          <div>
            <span class="pricing-eyebrow">GRILLE DE RÉFÉRENCE US</span>
            <h2>EUR Etsy → prix affiché USA</h2>
            <p>De 4,99 $ à 499,99 $. Clique sur une ligne pour copier la valeur EUR prête à coller.</p>
          </div>
        </div>
        <table class="pricing-reference-table">
          <thead><tr><th>EUR à saisir dans Etsy</th><th>Prix affiché USA</th></tr></thead>
          <tbody data-pricing-reference-body></tbody>
        </table>
      </section>
    </div>`;

  const showCopied = (value) => {
    let toast = document.getElementById('pipelinePricingCopyToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pipelinePricingCopyToast';
      toast.className = 'pricing-copy-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = `${value} copié`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
  };

  const copyValue = async (value) => {
    const text = String(value || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    showCopied(text);
  };

  const getSelectedScales = (prefix) => global.PipelineUIEchelles?.getSelectedScaleEntries?.(prefix) || [];

  const captureRows = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    const state = getState(prefix);
    root.querySelectorAll('[data-pricing-row]').forEach((row) => {
      const key = row.dataset.pricingRow;
      const price = row.querySelector('[data-price-fr]')?.value || '';
      const compensation = row.querySelector('[data-compensation-value]')?.value || '0';
      state.rows[key] = { priceFr: price, compensation };
    });
  };

  const getRowCalculation = (row) => {
    const priceFr = readNumber(row.querySelector('[data-price-fr]')?.value);
    const compensation = readNumber(row.querySelector('[data-compensation-value]')?.value);
    const rate = getRate();
    const natural = suggestedUsdFromEuro(priceFr, rate);
    const final = suggestedUsdFromEuro(priceFr + (Number.isFinite(compensation) ? compensation : 0), rate);
    return {
      priceFr,
      naturalUsd: natural.target,
      finalUsd: final.target,
      etsyEur: final.target * rate,
    };
  };

  const updatePricingRow = (row) => {
    const calculation = getRowCalculation(row);
    row.querySelector('[data-us-natural]').textContent = calculation.naturalUsd ? usd(calculation.naturalUsd) : '—';
    row.querySelector('[data-us-final]').textContent = calculation.finalUsd ? usd(calculation.finalUsd) : '—';
    row.querySelector('[data-etsy-eur]').textContent = calculation.finalUsd ? euro(calculation.etsyEur) : '—';
    row.dataset.copyValue = calculation.finalUsd ? plainEuro(calculation.etsyEur) : '';
    row.classList.toggle('is-copyable', Boolean(row.dataset.copyValue));
  };

  const persist = (prefix) => {
    captureRows(prefix);
    global.saveFormState?.();
    document.dispatchEvent(new CustomEvent('pipeline:pricing-changed', {
      detail: { prefix },
    }));
  };

  const bindPricingRow = (row, prefix) => {
    const priceInput = row.querySelector('[data-price-fr]');
    const compensationInput = row.querySelector('[data-compensation-value]');

    const syncCompensation = () => {
      const value = readNumber(compensationInput.value);
      compensationInput.value = Number.isFinite(value) && value >= 0 ? String(value) : '0';
      updatePricingRow(row);
      persist(prefix);
    };

    priceInput.addEventListener('input', () => {
      updatePricingRow(row);
      persist(prefix);
    });
    priceInput.addEventListener('change', () => {
      priceInput.value = normalizeManualFrPrice(priceInput.value);
      updatePricingRow(row);
      persist(prefix);
    });
    compensationInput.addEventListener('input', syncCompensation);
    row.querySelectorAll('[data-compensation-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const current = readNumber(compensationInput.value);
        const direction = Number(button.dataset.compensationStep);
        compensationInput.value = String(Math.max(0, (Number.isFinite(current) ? current : 0) + direction * 5));
        syncCompensation();
      });
    });
    row.querySelectorAll('input, select, button, label').forEach((control) => {
      control.addEventListener('click', (event) => event.stopPropagation());
    });
    row.addEventListener('click', () => copyValue(row.dataset.copyValue));
    row.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === row) {
        event.preventDefault();
        copyValue(row.dataset.copyValue);
      }
    });
  };

  const renderScaleRows = (prefix, { captureExisting = true } = {}) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    if (captureExisting) captureRows(prefix);
    const state = getState(prefix);
    const entries = getSelectedScales(prefix);
    const body = root.querySelector('[data-pricing-scale-body]');
    const empty = root.querySelector('[data-pricing-empty]');
    if (!body || !empty) return;

    empty.hidden = entries.length > 0;
    body.innerHTML = entries.map((entry) => {
      const rowState = state.rows[entry.key] || {
        priceFr: '',
        compensation: '0',
      };
      return `
        <tr data-pricing-row="${entry.key}" tabindex="0" title="Cliquer pour copier la valeur EUR Etsy">
          <td class="pricing-scale-cell"><strong>${escapeHtml(entry.label)}</strong>${entry.isOrigin ? '<span>Origine</span>' : ''}</td>
          <td><label class="pricing-money-input"><input data-price-fr type="number" min="0" step="5" inputmode="decimal" value="${escapeHtml(rowState.priceFr)}"><span>€</span></label></td>
          <td data-us-natural>—</td>
          <td>
            <div class="pricing-compensation-control">
              <button type="button" data-compensation-step="-1" aria-label="Retirer 5 euros de compensation">−</button>
              <label><input data-compensation-value type="number" min="0" step="5" inputmode="decimal" value="${escapeHtml(rowState.compensation || '0')}"><span>€</span></label>
              <button type="button" data-compensation-step="1" aria-label="Ajouter 5 euros de compensation">+</button>
            </div>
          </td>
          <td data-us-final>—</td>
          <td class="pricing-etsy-cell" data-etsy-eur>—</td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-pricing-row]').forEach((row) => {
      const key = row.dataset.pricingRow;
      const rowState = state.rows[key] || { priceFr: '', compensation: '0' };
      bindPricingRow(row, prefix);
      updatePricingRow(row);
    });

  };

  const getCalculatedRecommendation = (prefix) => {
    const total = Number(getState(prefix).calculator.total);
    const rate = getRate();
    if (!(total > 0) || !(rate > 0)) return null;
    const suggestion = suggestedUsdFromEuro(total, rate);
    return {
      total,
      rate,
      rawUsd: total / rate,
      targetUsd: suggestion.target,
      etsyEur: suggestion.target * rate,
      mode: suggestion.mode,
    };
  };

  const updateRecommendationUi = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    const recommendation = getCalculatedRecommendation(prefix);
    const strategy = root.querySelector('[data-recommendation-strategy]');
    const raw = root.querySelector('[data-recommendation-raw]');
    const usTarget = root.querySelector('[data-recommendation-us]');
    const eurTarget = root.querySelector('[data-recommendation-eur]');
    const copyButton = root.querySelector('[data-recommendation-copy]');
    if (!recommendation) {
      strategy.textContent = 'En attente d’un prix';
      strategy.dataset.mode = 'none';
      raw.textContent = '—';
      usTarget.textContent = '—';
      eurTarget.textContent = '—';
      copyButton.dataset.copyValue = '';
      copyButton.disabled = true;
      return;
    }

    const labels = {
      acquisition: 'Acquisition · palier inférieur',
      standard: 'Standard · palier le plus proche',
      premium: 'Premium · palier supérieur',
    };
    strategy.textContent = labels[recommendation.mode] || 'Positionnement calculé';
    strategy.dataset.mode = recommendation.mode;
    raw.textContent = usd(recommendation.rawUsd);
    usTarget.textContent = usd(recommendation.targetUsd);
    eurTarget.textContent = euro(recommendation.etsyEur);
    copyButton.dataset.copyValue = plainEuro(recommendation.etsyEur);
    copyButton.disabled = false;
  };

  const updateReferenceHighlight = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    const recommendation = getCalculatedRecommendation(prefix);
    root.querySelectorAll('[data-reference-usd]').forEach((row) => {
      const isMatch = Boolean(recommendation)
        && Math.abs(Number(row.dataset.referenceUsd) - recommendation.targetUsd) < 0.001;
      row.classList.toggle('is-calculated-price', isMatch);
      const marker = row.querySelector('[data-reference-marker]');
      if (marker) marker.textContent = isMatch ? `Prix calculé ${plainEuro(recommendation.total)} €` : '';
    });
  };

  const renderReferenceTable = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    const body = root?.querySelector('[data-pricing-reference-body]');
    if (!body) return;
    const rate = getRate();
    const rows = [];
    for (let nominal = 5; nominal <= MAX_USD_NOMINAL; nominal += 5) {
      const dollars = usdPricePoint(nominal);
      const euros = dollars * rate;
      rows.push(`<tr tabindex="0" data-reference-copy="${plainEuro(euros)}" data-reference-usd="${dollars.toFixed(2)}" title="Cliquer pour copier ${plainEuro(euros)}"><td><span>${euro(euros)}</span><small data-reference-marker></small></td><td>${usd(dollars)}</td></tr>`);
    }
    body.innerHTML = rows.join('');
    body.querySelectorAll('[data-reference-copy]').forEach((row) => {
      row.addEventListener('click', () => copyValue(row.dataset.referenceCopy));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          copyValue(row.dataset.referenceCopy);
        }
      });
    });
    updateReferenceHighlight(prefix);
  };

  const syncRateInputs = () => {
    const rate = getRate();
    document.querySelectorAll('[data-usd-rate]').forEach((input) => {
      if (document.activeElement !== input) input.value = rate.toFixed(6);
    });
  };

  const recalculateAllPricing = () => {
    syncRateInputs();
    PREFIXES.forEach((prefix) => {
      const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
      root?.querySelectorAll('[data-pricing-row]').forEach(updatePricingRow);
      renderReferenceTable(prefix);
      updateRecommendationUi(prefix);
    });
  };

  const setRateStatus = (message, type = '') => {
    document.querySelectorAll('[data-rate-status]').forEach((status) => {
      status.textContent = message;
      status.className = type ? `is-${type}` : '';
    });
  };

  const checkLiveRate = async (button) => {
    const previousRate = getRate();
    button.disabled = true;
    button.textContent = '↻ Vérification…';
    setRateStatus('Connexion au taux de référence BCE…');
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rate/USD/EUR?providers=ECB', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rate = Number(data.rate);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Taux invalide');
      localStorage.setItem(RATE_STORAGE_KEY, String(rate));
      localStorage.setItem(RATE_DATE_STORAGE_KEY, String(data.date || ''));
      recalculateAllPricing();
      const dateText = data.date ? ` • taux du ${data.date}` : '';
      setRateStatus(`BCE via Frankfurter${dateText} • 1 USD = ${rate.toFixed(6)} EUR`, 'ok');
    } catch (error) {
      localStorage.setItem(RATE_STORAGE_KEY, String(previousRate));
      recalculateAllPricing();
      setRateStatus('Impossible de récupérer le taux. Le taux actuel a été conservé.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = '↻ Vérifier le taux BCE';
    }
  };

  const applyCalculatedPriceToOriginScale = (prefix, total) => {
    const state = getState(prefix);
    captureRows(prefix);
    const origin = getSelectedScales(prefix).find((entry) => entry.isOrigin);
    if (!origin || !(Number(total) > 0)) return false;
    state.rows[origin.key] = {
      ...(state.rows[origin.key] || {}),
      priceFr: Number(total).toFixed(2),
      compensation: state.rows[origin.key]?.compensation || '0',
    };
    renderScaleRows(prefix, { captureExisting: false });
    return true;
  };

  const calculateCost = (prefix, { focusInvalid = false } = {}) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    const state = getState(prefix);
    const values = {};
    root.querySelectorAll('[data-calc-field]').forEach((field) => {
      values[field.dataset.calcField] = field.value;
    });
    Object.assign(state.calculator, values);

    const cost = readNumber(values.resinCost);
    const support = readNumber(values.supportVariable);
    const finalMultiplier = readNumber(values.finalMultiplier);
    const taxDivider = readNumber(values.tax);
    const plateCount = readNumber(values.plates);
    const error = root.querySelector('[data-pricing-error]');
    error.textContent = '';

    const invalid = [
      [!Number.isFinite(cost) || cost < 0, 'Entre un coût en résine valide.', 'resinCost'],
      [!Number.isFinite(support) || support <= 0, 'Entre une variable de support valide.', 'supportVariable'],
      [!Number.isFinite(taxDivider) || taxDivider <= 0, 'Entre une taxe / un diviseur valide.', 'tax'],
    ].find(([condition]) => condition);
    if (invalid) {
      state.calculator.total = 0;
      error.textContent = invalid[1];
      if (focusInvalid) root.querySelector(`[data-calc-field="${invalid[2]}"]`)?.focus();
      updateCostOutput(prefix, null);
      return;
    }

    const supportBase = cost * support;
    const base = supportBase * finalMultiplier;
    const extra = Math.max(0, plateCount - 1);
    const penalty = extra * 5;
    const subtotal = base + penalty;
    const total = subtotal / taxDivider;
    state.calculator.total = total;
    updateCostOutput(prefix, { cost, support, finalMultiplier, taxDivider, supportBase, base, extra, penalty, subtotal, total });
  };

  const updateCostOutput = (prefix, result) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    const set = (selector, value) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = value;
    };
    if (!result) {
      set('[data-cost-total]', euro(0));
      set('[data-cost-support]', euro(0));
      set('[data-cost-base]', euro(0));
      set('[data-cost-subtotal]', euro(0));
      set('[data-cost-extra]', '0');
      set('[data-cost-penalty]', euro(0));
      set('[data-cost-formula]', 'Base : coût résine × variable de support × multiplicateur final. Taxe appliquée sur le total, malus inclus.');
    } else {
      set('[data-cost-total]', euro(result.total));
      set('[data-cost-support]', euro(result.supportBase));
      set('[data-cost-base]', euro(result.base));
      set('[data-cost-subtotal]', euro(result.subtotal));
      set('[data-cost-extra]', String(result.extra));
      set('[data-cost-penalty]', euro(result.penalty));
      set('[data-cost-formula]', `(${euro(result.cost)} × ${result.support} × ${result.finalMultiplier} + ${result.extra} × 5 €) ÷ ${result.taxDivider} = ${euro(result.total)}`);
    }
    const transferButton = root.querySelector('[data-pricing-transfer-origin]');
    if (transferButton) transferButton.disabled = !result || !(result.total > 0);
    updateRecommendationUi(prefix);
    updateReferenceHighlight(prefix);
  };

  const restoreCalculatorUi = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    const calculator = getState(prefix).calculator;
    if (!root) return;
    root.querySelectorAll('[data-calc-field]').forEach((field) => {
      field.value = calculator[field.dataset.calcField] ?? '';
    });
    if (calculator.resinCost !== '') calculateCost(prefix);
    else updateCostOutput(prefix, null);
  };

  const bindShell = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root || root.dataset.pricingReady === 'true') return;
    root.dataset.pricingReady = 'true';
    const form = root.querySelector('[data-pricing-calculator]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      calculateCost(prefix, { focusInvalid: true });
      persist(prefix);
    });
    form.querySelectorAll('[data-calc-field]').forEach((field) => {
      field.addEventListener('input', () => {
        calculateCost(prefix);
        persist(prefix);
      });
      field.addEventListener('change', () => {
        calculateCost(prefix);
        persist(prefix);
      });
    });
    root.querySelector('[data-pricing-transfer-origin]').addEventListener('click', () => {
      const total = Number(getState(prefix).calculator.total);
      if (!applyCalculatedPriceToOriginScale(prefix, total)) return;
      persist(prefix);
      showCopied(`${euro(total)} transféré vers l’échelle d’origine`);
    });
    root.querySelector('[data-pricing-reset]').addEventListener('click', () => {
      getState(prefix).calculator = createDefaultCalculator();
      restoreCalculatorUi(prefix);
      persist(prefix);
      root.querySelector('[data-calc-field="resinCost"]')?.focus();
    });
    root.querySelector('[data-recommendation-copy]').addEventListener('click', (event) => {
      copyValue(event.currentTarget.dataset.copyValue);
    });
    root.querySelector('[data-usd-rate]').addEventListener('input', (event) => {
      const rate = readNumber(event.target.value);
      if (!Number.isFinite(rate) || rate <= 0) return;
      localStorage.setItem(RATE_STORAGE_KEY, String(rate));
      localStorage.removeItem(RATE_DATE_STORAGE_KEY);
      setRateStatus('Taux modifié manuellement. Vérification à la demande.');
      recalculateAllPricing();
    });
    root.querySelector('[data-check-rate]').addEventListener('click', (event) => checkLiveRate(event.currentTarget));
  };

  const initializePrefix = (prefix) => {
    const root = document.querySelector(`[data-pricing-prefix="${prefix}"]`);
    if (!root) return;
    if (!root.innerHTML.trim()) root.innerHTML = buildShell(prefix);
    bindShell(prefix);
    restoreCalculatorUi(prefix);
    syncRateInputs();
    const savedRateDate = localStorage.getItem(RATE_DATE_STORAGE_KEY);
    if (savedRateDate) setRateStatus(`Dernier taux BCE vérifié • ${savedRateDate} • 1 USD = ${getRate().toFixed(6)} EUR`, 'ok');
    renderScaleRows(prefix);
    renderReferenceTable(prefix);
  };

  const initialize = () => PREFIXES.forEach(initializePrefix);

  const serialize = (prefix) => {
    captureRows(prefix);
    const state = getState(prefix);
    return JSON.parse(JSON.stringify(state));
  };

  const getPublicationRows = (prefix) => {
    captureRows(prefix);
    const state = getState(prefix);

    return getSelectedScales(prefix).map((entry) => {
      const rowState = state.rows[entry.key] || {};
      const priceFr = readNumber(rowState.priceFr);
      const compensation = readNumber(rowState.compensation);

      return {
        ...entry,
        priceFr: Number.isFinite(priceFr) && priceFr > 0 ? priceFr : null,
        compensation: Number.isFinite(compensation) && compensation >= 0 ? compensation : 0,
      };
    });
  };

  const restore = (prefix, savedState) => {
    initializePrefix(prefix);
    if (savedState && typeof savedState === 'object') {
      const calculator = { ...createDefaultCalculator(), ...(savedState.calculator || {}) };
      const rows = savedState.rows && typeof savedState.rows === 'object' ? savedState.rows : {};
      stateByPrefix.set(prefix, { calculator, rows });
    }
    restoreCalculatorUi(prefix);
    renderScaleRows(prefix, { captureExisting: false });
  };

  document.addEventListener('pipeline:scales-changed', (event) => {
    const prefix = event.detail?.prefix;
    if (PREFIXES.includes(prefix)) renderScaleRows(prefix);
  });

  global.PipelineUIPricing = {
    initialize,
    renderScaleRows,
    serialize,
    restore,
    getPublicationRows,
    suggestedUsdFromEuro,
  };
  global.PipelineUI.pricing = global.PipelineUIPricing;

  initialize();
})(window);
