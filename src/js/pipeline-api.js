// ═══ PIPELINE API ═══

// Appel HTTP Anthropic.
// Fonction sensible : gère aussi les retries, le prompt caching, les images et les
// AbortController. Toute extraction future doit préserver exactement ce contrat réseau.


// Runtime réseau + orchestration pipeline.
// État actuel : ce fichier ne contient pas seulement les appels API. Il regroupe encore
// l'appel Anthropic, l'orchestrateur QA, l'exécution des agents, une partie du runtime
// pipeline, les agents sociaux, les helpers de copie et le monitoring des coûts.
// Découpage visé : extraire progressivement les blocs les moins risqués (social / copy /
// reporting) vers des modules UI dédiés, puis traiter le coeur pipeline en dernier.
// Important : ne pas lancer de refactor brutal ici sans campagne de retest complète.

async function callClaude(agentId, promptData, useImages, retries = 3) {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) throw new Error('Clé API manquante');
  const controller = new AbortController();
  abortControllers[agentId] = controller;
  const isLegacy = typeof promptData === 'string';
  const promptText = isLegacy ? promptData : promptData.filled;
  const fixedContent = isLegacy ? null : promptData.fixedContent;
  const content = [];
  const p = pfx();
  if (useImages && state.images[p].length > 0) {
    for (const img of state.images[p]) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    }
  }
  if (fixedContent && fixedContent.length > 4096) {
    content.push({ type: 'text', text: fixedContent, cache_control: { type: 'ephemeral' } });
    content.push({ type: 'text', text: promptText });
  } else {
    content.push({ type: 'text', text: promptText });
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: controller.signal,
        headers: {
          'Content-Type': 'application/json', 'x-api-key': apiKey,
          'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: AGENT_MODELS[agentId] || 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content }] })
      });
      if (res.status === 529) {
        if (attempt < retries) { const delay = attempt * 10000; const out = document.getElementById(`out-${agentId}`); if (out) out.textContent = `⏳ Retry ${attempt}/${retries} dans ${delay/1000}s...`; await new Promise(r => setTimeout(r, delay)); continue; }
        throw new Error('Serveurs Anthropic surchargés. Réessaie dans quelques minutes.');
      }
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      delete abortControllers[agentId];
      const text = data.content.map(b => b.text || '').join('\n');
      return { text, usage: data.usage || {} };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Génération stoppée');
      if (attempt === retries) throw err;
      if (err.message.includes('529') || err.message.toLowerCase().includes('overload')) {
        const delay = attempt * 10000;
        const out = document.getElementById(`out-${agentId}`);
        if (out) out.textContent = `⏳ Retry ${attempt}/${retries}...`;
        await new Promise(r => setTimeout(r, delay));
      } else throw err;
    }
  }
}


// ═══════════════════════════════════════════════════════════
// QA secondaire optionnelle.
// Ce bloc reste ici car il est directement branché au runtime d'exécution des agents.

// ORCHESTRATEUR
// ═══════════════════════════════════════════════════════════
function toggleOrchestrator() {
  state.orchestrateurActif = !state.orchestrateurActif;
  const btn = document.getElementById('orchToggleBtn');
  btn.textContent = `🔍 Orchestrateur ${state.orchestrateurActif ? 'ON' : 'OFF'}`;
  btn.className = `btn ${state.orchestrateurActif ? 'btn-success' : 'btn-muted'}`;
  showToast(`Orchestrateur ${state.orchestrateurActif ? 'activé' : 'désactivé'}`);
}

async function runOrchestrator(agentId, output) {
  const ctx = buildCtx(agentId);
  const attempt = (state.orchAttempts[agentId] || 0) + 1;
  state.orchAttempts[agentId] = attempt;
  const orchCtx = { ...ctx, agent_id: agentId, tentative: attempt, output_to_validate: output };
  const prompt = buildPrompt('orchestrateur', orchCtx);
  try {
    const { text: result } = await callClaude('orchestrateur', prompt.filled, false, 2);
    const clean = result.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return { statut: 'VALIDE', agent: agentId, tentative: attempt, problemes: [], correction: '', score: '?/?' };
  }
}

function showOrchestratorBadge(agentId, result) {
  const existing = document.getElementById(`orch-badge-${agentId}`);
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = `orch-badge-${agentId}`;
  badge.style.cssText = 'margin:4px 0 8px;padding:7px 11px;border-radius:6px;font-family:Space Mono,monospace;font-size:11px;line-height:1.6;';
  const problems = (result.problemes || []).slice(0, 2).join(' • ');
  if (result.statut === 'VALIDE') {
    badge.style.cssText += 'background:rgba(76,175,125,.1);border:1px solid rgba(76,175,125,.3);color:#4caf7d;';
    if (result.tentative > 1) {
      const prev = (state._lastOrchProblems?.[agentId] || []).slice(0,2);
      badge.innerHTML = `✅ Corrigé après ${result.tentative - 1} relance${prev.length ? `<br><span style="opacity:.6;font-size:10px;">${prev.map(p => `✓ ${p}`).join('<br>')}</span>` : ''}`;
    } else badge.textContent = `✅ ${currentMode === 'collection' ? 'Rex' : 'Felix'} OK — ${result.score}`;
  } else if (result.statut === 'RELANCER') {
    if (!state._lastOrchProblems) state._lastOrchProblems = {};
    state._lastOrchProblems[agentId] = result.problemes || [];
    badge.style.cssText += 'background:rgba(232,197,71,.1);border:1px solid rgba(232,197,71,.3);color:#e8c547;';
    badge.innerHTML = `⟳ Relance ${result.tentative}/2${problems ? `<br><span style="opacity:.7;">${problems}</span>` : ''}`;
  } else {
    badge.style.cssText += 'background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.3);color:#ff4757;';
    badge.innerHTML = `❌ ALERTE${problems ? `<br><span style="opacity:.7;">${problems}</span>` : ''}`;
  }
  const body = document.getElementById(`${pfx()}-body-${agentId}`);
  if (body) body.insertBefore(badge, body.firstChild);
}

// ═══════════════════════════════════════════════════════════
// Cœur d'exécution agent par agent.
// Zone à haut risque : couplage fort entre état, prompts, DOM, orchestrateur et cartes UI.
// C'est l'une des dernières parties à découper, pas une cible de nettoyage opportuniste.

// RUN AGENT
// ═══════════════════════════════════════════════════════════
async function runAgent(agent, correction = '', isRetry = false) {
  const p = pfx();
  const card = document.getElementById(`${p}-card-${agent.id}`);
  const stat = document.getElementById(`${p}-stat-${agent.id}`);
  const out = document.getElementById(`${p}-out-${agent.id}`);
  const stopBtn = document.getElementById(`${p}-bstop-${agent.id}`);
  card.className = 'agent-card active';
  updatePipelineTimeline(agent.id, 'active');
  stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...';
  const ctxEl = document.getElementById('headerContext');
  if (ctxEl) ctxEl.textContent = agent.title.replace(/^[🔍🖼️📊🔖🏷️📝]/u,'').trim();
  out.className = 'output-box'; out.textContent = '';
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  if (!['analyse','alt','marche'].includes(agent.id)) openCard(`${p}-${agent.id}`);
  if (agent.hasSelection && !isRetry) {
    state.selectedAccroche = null; state.selectedCTA = null; state.selectedTitre = null;
    [`${p}-sel-${agent.id}`, `${p}-sel-accroche-${agent.id}`, `${p}-sel-cta-${agent.id}`].forEach(id => {
      const z = document.getElementById(id);
      if (z) { z.classList.remove('visible'); const d = z.querySelector('[id]'); if (d) d.innerHTML = ''; }
    });
  }
  try {
    const ctx = buildCtx(agent.id, correction);
    const prompt = buildPrompt(agent.id, ctx);
    const rawFixed = prompt.fixedContent ? `── CACHE FIXE ──\n${prompt.fixedContent}\n\n── VARIABLE ──\n` : '';
    state.inputs[agent.id] = rawFixed + prompt.filled;
    const { text: result, usage } = await callClaude(agent.id, prompt, agent.usesImages);
    state.outputs[agent.id] = result;
    out.textContent = result;
    showAgentCost(agent.id, usage);
    if (agent.id === 'tags') buildTagsUI(result);
    if (state.orchestrateurActif) {
      stat.className = 'agent-status s-run'; stat.textContent = '🔍 audit...';
      const orchResult = await runOrchestrator(agent.id, result);
      showOrchestratorBadge(agent.id, orchResult);
      if (orchResult.statut === 'RELANCER' && (state.orchAttempts[agent.id] || 0) < 2) {
        stat.textContent = '⟳ relance...';
        return await runAgent(agent, orchResult.correction, true);
      } else if (orchResult.statut === 'ALERTE') {
        card.className = 'agent-card error';
        stat.className = 'agent-status s-err'; stat.textContent = '❌ alerte';
        document.getElementById(`${p}-br-${agent.id}`).disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
        showToast(`❌ Alerte orchestrateur: ${agent.id}`, '#ff4757');
        return false;
      }
    }
    card.className = 'agent-card done';
    updatePipelineTimeline(agent.id, 'done');
    if (agent.hasSelection) {
      stat.className = 'agent-status s-run'; stat.textContent = '⏳ sélection requise';
      if (agent.selectionType === 'titre') buildTitreSelectionUI(agent.id, result);
      else buildAccrocheCTASelectionUI(agent.id, result);
    } else {
      stat.className = 'agent-status s-done'; stat.textContent = '✓ done';
    }
    document.getElementById(`${p}-br-${agent.id}`).disabled = false;
    document.getElementById(`${p}-bs-${agent.id}`).disabled = false;
    document.getElementById(`${p}-bp-${agent.id}`).disabled = false;
    if (agent.id === 'tags') { const bex = document.getElementById(`${p}-bexplore-tags`); if (bex) bex.disabled = false; }
    if (agent.id === 'titre') { const bex = document.getElementById(`${p}-bexplore-titre`); if (bex) bex.disabled = false; }
    if (stopBtn) stopBtn.style.display = 'none';
    return true;
  } catch (err) {
    out.textContent = `❌ ${err.message}`;
    card.className = 'agent-card error';
    updatePipelineTimeline(agent.id, 'error');
    stat.className = 'agent-status s-err';
    stat.textContent = err.message.includes('stoppée') ? '⏹ stoppé' : '✗ erreur';
    document.getElementById(`${p}-br-${agent.id}`).disabled = false;
    if (stopBtn) stopBtn.style.display = 'none';
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Contrôle global du pipeline unitaire.
// Ce bloc orchestre aussi les transitions de vues et les déplacements DOM vers la vue
// pipeline. Toute extraction future devra être testée visuellement sur TT et Collection.

// PIPELINE CONTROL
// ═══════════════════════════════════════════════════════════
async function startPipeline(p) {
  if (state.images[p].length === 0) {
    document.getElementById(`imgWarning-${p}`).style.display = 'block';
    showToast('⚠️ Charge au moins une image !', '#ff4757');
    return;
  }
  document.getElementById(`imgWarning-${p}`).style.display = 'none';
  document.getElementById(`socialSection-${p}`).style.display = 'none';
  document.getElementById(`socialOutput-${p}`).style.display = 'none';
  [`ss-insta-${p}`,`ss-fb-${p}`,`ss-marketplace-${p}`,`ss-pinterest-${p}`].forEach(id => {
    const el = document.getElementById(id); if(el) el.style.display = 'none';
  });
  state.socialSections = {};
  document.getElementById(`finalOutput-${p}`).style.display = 'none';
  [`fs-titre-${p}`,`fs-tags-${p}`,`fs-description-${p}`,`fs-alt-${p}`].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const btn = document.getElementById(`runBtn-${p}`);
  btn.disabled = true; btn.textContent = '⟳ Pipeline en cours...';

  // ── Transition vers vue pipeline ──
  const pipelineBody = document.getElementById('pipelineViewBody');
  if (pipelineBody) {
    const pipelineEl = document.getElementById(`pipeline-${p}`);
    const finalEl = document.getElementById(`finalOutput-${p}`);
    if (pipelineEl) { pipelineEl.style.display = ''; pipelineBody.appendChild(pipelineEl); }
    if (finalEl) { pipelineBody.appendChild(finalEl); }
    // Réseaux sociaux aussi
    const socialSectionEl = document.getElementById(`socialSection-${p}`);
    if (socialSectionEl) pipelineBody.appendChild(socialSectionEl);
    const socialOutputEl = document.getElementById(`socialOutput-${p}`);
    if (socialOutputEl) pipelineBody.appendChild(socialOutputEl);
  }
  const titleEl = document.getElementById('pipelineViewTitle');
  if (titleEl) titleEl.textContent = currentMode === 'tabletop' ? '🎲 Pipeline Tabletop' : '🖼️ Pipeline Collection';
  // Update header context for pipeline view
  const ctx = document.getElementById('headerContext');
  if (ctx) { ctx.className = 'app-context mode-pipeline'; ctx.textContent = '⟳ Pipeline en cours...'; }
  buildPipelineTimeline();
  document.getElementById('btnStopGlobal').classList.add('visible');
  document.getElementById('btnNewFiche').classList.remove('visible');
  showView('pipeline');
  state.selectedAccroche = null; state.selectedCTA = null; state.selectedTitre = null;
  Object.keys(state.orchAttempts).forEach(k => delete state.orchAttempts[k]);
  getPipelineAgents().forEach(a => {
    state.outputs[a.id] = '';
    const card = document.getElementById(`${p}-card-${a.id}`);
    const stat = document.getElementById(`${p}-stat-${a.id}`);
    const out = document.getElementById(`${p}-out-${a.id}`);
    if (card) card.className = 'agent-card';
    if (stat) { stat.className = 'agent-status s-wait'; stat.textContent = 'en attente'; }
    if (out) { out.className = 'output-box empty'; out.textContent = '— pas encore généré —'; }
    const br = document.getElementById(`${p}-br-${a.id}`); if (br) br.disabled = true;
    const bs = document.getElementById(`${p}-bs-${a.id}`); if (bs) bs.disabled = true;
    const bp = document.getElementById(`${p}-bp-${a.id}`); if (bp) bp.disabled = true;
    const ob = document.getElementById(`orch-badge-${a.id}`); if (ob) ob.remove();
  });
  for (const agent of getPipelineAgents()) {
    const ok = await runAgent(agent);
    if (!ok) break;
    if (agent.hasSelection) break;
      // Mode collection — pipeline limité à 3 agents pendant la phase de test
    if (currentMode === 'collection' && agent.id === 'description') break;
  }
  btn.disabled = false; btn.innerHTML = '▶ Relancer tout';
  document.getElementById('btnStopGlobal').classList.remove('visible');
  document.getElementById('btnNewFiche').classList.add('visible');
  // Update timeline — all done
  getPipelineAgents().forEach(a => updatePipelineTimeline(a.id, 'done'));
}


// ═══════════════════════════════════════════════════════════
// RÈGLES PERSISTANTES
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Runtime social encore hébergé ici.
// Découpage visé à terme : déplacer progressivement ces flows vers un module social dédié,
// après stabilisation et retest des sorties Instagram / Facebook / Marketplace / Pinterest.

// RÉSEAUX SOCIAUX
// ═══════════════════════════════════════════════════════════
async function runLeoAgent(p) {
  const formats = [];
  if (document.getElementById(`soc-insta-${p}`)?.checked) formats.push('INSTAGRAM/TIKTOK');
  if (document.getElementById(`soc-fb-${p}`)?.checked) formats.push('FACEBOOK');
  if (document.getElementById(`soc-marketplace-${p}`)?.checked) formats.push('FACEBOOK MARKETPLACE');
  if (formats.length === 0) { showToast('Coche au moins un réseau !', '#ff4757'); return; }
  const card = document.getElementById(`card-social-${p}`);
  const stat = document.getElementById(`stat-social-${p}`);
  const out  = document.getElementById(`out-social-${p}`);
  const btn  = document.getElementById(`runLeoBtn-${p}`);
  const stopBtn = document.getElementById(`bstop-social-${p}`);
  if (card) card.className = 'agent-card active';
  if (stat) { stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...'; }
  if (out)  { out.className = 'output-box'; out.textContent = ''; }
  if (btn)  btn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  toggleCard(`social-${p}`);
  const correction = document.getElementById(`cor-social-${p}`)?.value || '';
  const ctx = buildCtx('social');
  ctx.social_formats = formats.join(', ');
  ctx.correction = correction;
  const prompt = buildPrompt('social', ctx);
  state.inputs['social'] = prompt.filled;
  try {
    const { text: result, usage } = await callClaude('social', prompt, false);
    state.outputs['social'] = result;
    if (out) out.textContent = result;
    if (card) card.className = 'agent-card done';
    if (stat) { stat.className = 'agent-status s-done'; stat.textContent = '✓ done'; }
    showAgentCost('social', usage);
    displaySocialOutput(result, p);
    showToast('Posts générés ✓');
  } catch (err) {
    if (out) out.textContent = `❌ ${err.message}`;
    if (card) card.className = 'agent-card error';
    if (stat) { stat.className = 'agent-status s-err'; stat.textContent = '✗ erreur'; }
    showToast(`❌ ${err.message}`, '#ff4757');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Générer'; }
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

async function runCamilleAgent(p) {
  if (!document.getElementById(`soc-pinterest-${p}`)?.checked) {
    showToast(`Active Pinterest pour ${currentMode === 'collection' ? 'Zoe' : 'Camille'} !`, '#ff4757');
    return;
  }
  const card = document.getElementById(`card-camille-${p}`);
  const stat = document.getElementById(`stat-camille-${p}`);
  const out  = document.getElementById(`out-camille-${p}`);
  const btn  = document.getElementById(`runCamilleBtn-${p}`);
  const stopBtn = document.getElementById(`bstop-camille-${p}`);
  if (card) card.className = 'agent-card active';
  if (stat) { stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...'; }
  if (out)  { out.className = 'output-box'; out.textContent = ''; }
  if (btn)  btn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  toggleCard(`camille-${p}`);
  const correction = document.getElementById(`cor-camille-${p}`)?.value || '';
  const ctx = buildCtx('camille');
  ctx.correction = correction;
  const prompt = buildPrompt('camille', ctx);
  state.inputs['camille'] = prompt.filled;
  try {
    const { text: result, usage } = await callClaude('camille', prompt, false);
    state.outputs['camille'] = result;
    if (out) out.textContent = result;
    if (card) card.className = 'agent-card done';
    if (stat) { stat.className = 'agent-status s-done'; stat.textContent = '✓ done'; }
    showAgentCost('camille', usage);
    displayCamilleOutput(result, p);
    showToast('Pinterest généré ✓');
  } catch (err) {
    if (out) out.textContent = `❌ ${err.message}`;
    if (card) card.className = 'agent-card error';
    if (stat) { stat.className = 'agent-status s-err'; stat.textContent = '✗ erreur'; }
    showToast(`❌ ${err.message}`, '#ff4757');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Générer'; }
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

function toggleReseauxOnly(p) {
  const section = document.getElementById(`reseauxOnlySection-${p}`);
  const btn = document.getElementById(`toggleReseauxOnlyBtn-${p}`);
  if (!section) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  if (btn) btn.textContent = isVisible ? '📋 Fiche déjà publiée' : '✕ Fermer';
}

function displaySocialOutput(result, p) {
  const sections = parseSocialSections(result);
  state.socialSections = sections;
  const so = document.getElementById(`socialOutput-${p}`);
  if (so) { so.style.display = 'flex'; so.style.flexDirection = 'column'; }
  const show = (id, content) => {
    if (!content) return;
    const wrap = document.getElementById(`ss-${id}-${p}`);
    if (wrap) wrap.style.display = 'block';
    const el = document.getElementById(`sc-${id}-${p}`);
    if (el) el.textContent = content;
  };
  show('insta', sections.insta);
  show('fb', sections.fb);
  show('marketplace', sections.marketplace);
  if (sections.pinterest || sections.pinterestTitre || sections.pinterestDesc) {
    const wrap = document.getElementById(`ss-pinterest-${p}`); if (wrap) wrap.style.display = 'block';
    if (sections.pinterestTitre) {
      const t = document.getElementById(`sc-pinterest-titre-${p}`); if (t) t.style.display = 'block';
      const tc = document.getElementById(`sc-pinterest-t-${p}`); if (tc) tc.textContent = sections.pinterestTitre;
    }
    if (sections.pinterestDesc) {
      const d = document.getElementById(`sc-pinterest-desc-wrap-${p}`); if (d) d.style.display = 'block';
      const dc = document.getElementById(`sc-pinterest-d-${p}`); if (dc) dc.textContent = sections.pinterestDesc;
    }
    if (sections.pinterestAlt) {
      const a = document.getElementById(`sc-pinterest-alt-wrap-${p}`); if (a) a.style.display = 'block';
      const ac = document.getElementById(`sc-pinterest-a-${p}`); if (ac) ac.textContent = sections.pinterestAlt;
    }
    if (!sections.pinterestTitre && !sections.pinterestDesc) {
      const d = document.getElementById(`sc-pinterest-desc-wrap-${p}`); if (d) d.style.display = 'block';
      const dc = document.getElementById(`sc-pinterest-d-${p}`); if (dc) dc.textContent = sections.pinterest;
    }
  }
}

function displayCamilleOutput(result, p) { displaySocialOutput(result, p); }

async function runReseauxOnly(type, p) {
  // Lire les overrides du formulaire "fiche déjà publiée"
  const nom       = document.getElementById(`ro-nom-${p}`)?.value || '';
  const sculpteur = document.getElementById(`ro-sculpteur-${p}`)?.value || '';
  const url       = document.getElementById(`ro-url-${p}`)?.value || '';
  const accroche  = document.getElementById(`ro-accroche-${p}`)?.value || '';
  const cta       = document.getElementById(`ro-cta-${p}`)?.value || '';
  const titre     = document.getElementById(`ro-titre-${p}`)?.value || '';

  // Sauvegarder les valeurs courantes
  const prevAccroche   = state.selectedAccroche;
  const prevCTA        = state.selectedCTA;
  const prevTitre      = state.outputs.titre_valide;
  const nomEl          = document.getElementById(`${p}-fNom`);
  const sculpteurEl    = document.getElementById(`${p}-fSculpteur`);
  const urlEl          = document.getElementById(`${p}-fUrlBoutique`);
  const prevNom        = nomEl?.value || '';
  const prevSculpteur  = sculpteurEl?.value || '';
  const prevUrl        = urlEl?.value || '';

  // Appliquer les overrides
  if (accroche) state.selectedAccroche = { text: accroche };
  if (cta)      state.selectedCTA      = { text: cta };
  if (titre)    state.outputs.titre_valide = titre;
  if (nom       && nomEl)      nomEl.value      = nom;
  if (sculpteur && sculpteurEl) sculpteurEl.value = sculpteur;
  if (url       && urlEl)      urlEl.value      = url;
  // echelles : injecter via un champ texte libre lu par buildCtx si dispo
  const nomCourtEl = document.getElementById(`${p}-fNomCourt`);
  const prevNomCourt = nomCourtEl?.value || '';
  if (nom && nomCourtEl) nomCourtEl.value = nom;

  try {
    if (type === 'leo'    || type === 'both') await runLeoAgent(p);
    if (type === 'camille'|| type === 'both') await runCamilleAgent(p);
  } finally {
    // Restaurer
    state.selectedAccroche     = prevAccroche;
    state.selectedCTA          = prevCTA;
    state.outputs.titre_valide = prevTitre;
    if (nomEl)       nomEl.value       = prevNom;
    if (nomCourtEl)  nomCourtEl.value  = prevNomCourt;
    if (sculpteurEl) sculpteurEl.value = prevSculpteur;
    if (urlEl)       urlEl.value       = prevUrl;
  }
}

function parseSocialSections(output) {
  const sections = { insta:'', fb:'', marketplace:'', pinterest:'', pinterestTitre:'', pinterestDesc:'', pinterestAlt:'' };
  const clean = output.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,3}\s*/g, '');
  const parts = clean.split(/(?:^|\n)\s*(INSTAGRAM(?:\/TIKTOK)?|TIKTOK|FACEBOOK MARKETPLACE|FACEBOOK|PINTEREST)\s*\n/im);
  for (let i = 1; i < parts.length; i += 2) {
    const marker = (parts[i] || '').trim().toLowerCase();
    const content = (parts[i + 1] || '').trim();
    if (marker.includes('instagram') || marker === 'tiktok') sections.insta = content;
    else if (marker.includes('facebook marketplace')) sections.marketplace = content;
    else if (marker.includes('facebook')) sections.fb = content;
    else if (marker.includes('pinterest')) {
      sections.pinterest = content;
      const pBlocks = content.split(/\n---+\n/);
      if (pBlocks[0]) sections.pinterestTitre = pBlocks[0].replace(/^TITRE PINTEREST\s*:\s*/i, '').trim();
      if (pBlocks[1]) sections.pinterestDesc  = pBlocks[1].replace(/^DESCRIPTION PINTEREST\s*:\s*/i, '').trim();
      if (pBlocks[2]) sections.pinterestAlt   = pBlocks[2].replace(/^BALISE ALT PINTEREST\s*:\s*/i, '').trim();
    }
  }
  if (!sections.insta && parts[0] && parts[0].trim().length > 20) sections.insta = parts[0].trim();
  if (!sections.insta && !sections.fb && !sections.pinterest) sections.insta = clean.trim();
  return sections;
}

function copySocialSection(id) {
  const keyMap = { insta:'insta', fb:'fb', pinterest:'pinterest', pinterestTitre:'pinterestTitre', pinterestDesc:'pinterestDesc', pinterestAlt:'pinterestAlt' };
  navigator.clipboard.writeText(state.socialSections?.[keyMap[id]] || '');
  showToast('Copié ✓');
}

function copySocial() { navigator.clipboard.writeText(state.outputs['social'] || ''); showToast('Posts copiés ✓'); }

// ═══════════════════════════════════════════════════════════
// OUTPUT FINAL
// ═══════════════════════════════════════════════════════════

function copySection(key) { navigator.clipboard.writeText(state.outputs[key] || ''); showToast('Copié ✓'); }
function copyAll() {
  const parts = [];
  if (state.outputs.titre_valide) parts.push(`── TITRE ──\n${state.outputs.titre_valide}`);
  if (state.outputs.tags) parts.push(`── TAGS ──\n${state.outputs.tags}`);
  const desc = state.outputs['description_assembled'] || state.outputs.description;
  if (desc) parts.push(`── DESCRIPTION ──\n${desc}`);
  if (state.outputs.alt) parts.push(`── BALISE ALT ──\n${state.outputs.alt}`);
  navigator.clipboard.writeText(parts.join('\n\n'));
  showToast('Tout copié ✓');
}

// ═══════════════════════════════════════════════════════════
// TITRE EXPLORER
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Monitoring session.
// Affichage UI + cumul de coût runtime. Bloc isolable plus tard, mais déplacé seulement
// quand le coeur pipeline et le reporting auront des contrats plus stables.

// MONITORING COÛTS
// ═══════════════════════════════════════════════════════════
function showAgentCost(agentId, usage) {
  if (!usage) return;
  const isHaiku = (AGENT_MODELS[agentId] || '').includes('haiku');
  const PRICE = isHaiku ? { input:0.80/1_000_000, cacheWrite:1.00/1_000_000, cacheRead:0.08/1_000_000, output:4.00/1_000_000 }
                        : { input:3.00/1_000_000, cacheWrite:3.75/1_000_000, cacheRead:0.30/1_000_000, output:15.00/1_000_000 };
  const inputTok   = usage.input_tokens || 0;
  const outputTok  = usage.output_tokens || 0;
  const cacheRead  = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const normalIn   = inputTok - cacheRead - cacheWrite;
  const cost = (normalIn * PRICE.input) + (cacheWrite * PRICE.cacheWrite) + (cacheRead * PRICE.cacheRead) + (outputTok * PRICE.output);
  const costCents = cost * 100;
  state.sessionCost += costCents;
  state.agentUsage[agentId] = { inputTok, outputTok, cacheRead, cacheWrite, normalIn, costCents };
  const existing = document.getElementById(`cost-badge-${agentId}`);
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = `cost-badge-${agentId}`;
  badge.style.cssText = 'margin:4px 0 6px;padding:4px 10px;border-radius:4px;font-family:Space Mono,monospace;font-size:10px;color:var(--muted);background:rgba(255,255,255,.03);border:1px solid var(--border);display:flex;gap:12px;flex-wrap:wrap;';
  const parts = [`📥 in: ${inputTok.toLocaleString()} tok`, `📤 out: ${outputTok.toLocaleString()} tok`];
  if (cacheWrite > 0) parts.push(`✍️ écrit: ${cacheWrite.toLocaleString()} tok`);
  if (cacheRead > 0) parts.push(`⚡ lu: ${cacheRead.toLocaleString()} tok`);
  parts.push(`💰 ${costCents.toFixed(3)}¢`);
  badge.innerHTML = parts.join('<span style="opacity:.3;">|</span>');
  const body = document.getElementById(`${pfx()}-body-${agentId}`);
  if (body) body.insertBefore(badge, body.firstChild);
  const sessionEl = document.getElementById('session-cost');
  if (sessionEl) {
    sessionEl.textContent = `💰 ${state.sessionCost.toFixed(2)}¢`;
    if (state.sessionCost > 10) sessionEl.style.color = 'var(--accent)';
    if (state.sessionCost > 20) sessionEl.style.color = 'var(--error)';
  }
}

function copyTokenReport() {
  const isTT = currentMode === 'tabletop';
  const AGENT_LABELS = isTT
    ? { analyse:'01 Analyse', alt:'02 Alt', marche:'03 Marché', tags:'04 Tags', titre:'05 Titres', description:'06 Description', social:'07 Léo', camille:'08 Camille', orchestrateur:'QA Felix' }
    : { analyse:'01 Jules', alt:'02 Iris', marche:'03 Luna', tags:'04 Axel', titre:'05 Nova', description:'06 Eden', social:'07 Theo', camille:'08 Zoe', orchestrateur:'QA Rex' };
  const lines = ['═══ RAPPORT SESSION ═══'];
  let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = 0;
  for (const [id, label] of Object.entries(AGENT_LABELS)) {
    const u = state.agentUsage[id]; if (!u) continue;
    const cacheStr = u.cacheRead > 0 ? ` ⚡${u.cacheRead.toLocaleString()}` : '';
    lines.push(`${label.padEnd(16)}: in ${String(u.inputTok).padStart(6)} | out ${String(u.outputTok).padStart(5)} | ${u.costCents.toFixed(3)}¢${cacheStr}`);
    totalIn += u.inputTok; totalOut += u.outputTok; totalCache += u.cacheRead; totalCost += u.costCents;
  }
  lines.push('──────────────────────────────────────');
  lines.push(`TOTAL           : in ${String(totalIn).padStart(6)} | out ${String(totalOut).padStart(5)} | ${totalCost.toFixed(3)}¢`);
  lines.push(`\nGénéré le ${new Date().toLocaleString('fr-FR')}`);
  navigator.clipboard.writeText(lines.join('\n'));
  showToast('Rapport copié ✓');
}

// ═══════════════════════════════════════════════════════════
// PERSISTANCE FORMULAIRE
// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════