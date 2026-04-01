(function initPipelineUIBatch(global) {
  // Runtime batch.
  // État actuel : module encore dense, avec beaucoup de génération DOM inline et de glue
  // batch spécifique. Il est fonctionnel mais reste un bon candidat à un futur nettoyage
  // incrémental une fois les flows batch stabilisés.
  global.PipelineUI = global.PipelineUI || {};

  const createInitialBatchState = () => ({
    fiches: [],
    current: -1,
    stopped: false,
    running: false,
    stoppedByUser: false,
    lastError: "",
  });

  // Le wrapper batch traverse les vues Form → Pipeline.
  // Ce helper borne uniquement sa phase visuelle, sans changer la logique métier du POC.
  const setBatchWrapperPhase = (phase) => {
    const batchWrapper = document.getElementById("batchWrapper");
    if (!batchWrapper) return;

    batchWrapper.classList.toggle("is-running", phase === "running");
  };

  const getBatchCurrentPipelineElements = () => ({
    host: document.querySelector('[data-js="batch-current-pipeline"]'),
    meta: document.querySelector('[data-js="batch-current-meta"]'),
    list: document.querySelector('[data-js="batch-current-list"]'),
  });

  const getBatchFicheLabel = (index) => {
    const shortName = document.getElementById(`b${index}-fNomCourt`)?.value?.trim();

    return shortName || `Fiche ${index + 1}`;
  };

  const getBatchAgentLabel = (agent) =>
    agent.title
      .replace(/^[^—]+— /, "")
      .split(" · ")[0]
      .replace(/[🔍🖼️📊🔖🏷️📝]/u, "")
      .trim();

  const resetBatchCurrentPipeline = () => {
    const { host, meta, list } = getBatchCurrentPipelineElements();
    if (!host || !meta || !list) return;

    host.classList.add("is-hidden");
    meta.textContent = "";
    list.innerHTML = "";
  };

  const renderBatchCurrentPipeline = (ficheIndex, ficheTotal, agents) => {
    const { host, meta, list } = getBatchCurrentPipelineElements();
    if (!host || !meta || !list) return;

    meta.textContent = `Fiche ${ficheIndex + 1}/${ficheTotal} — ${getBatchFicheLabel(ficheIndex)}`;
    list.innerHTML = agents
      .map(
        (agent, index) => `
          <div class="agent-card batch-current-agent-card" data-batch-agent="${agent.id}">
            <div class="agent-header">
              <span class="agent-num">${String(index + 1).padStart(2, "0")}</span>
              <span class="agent-title">${getBatchAgentLabel(agent)}</span>
              <span class="agent-status s-wait" data-batch-agent-status="${agent.id}">en attente</span>
            </div>
          </div>`,
      )
      .join("");

    host.classList.remove("is-hidden");
  };

  const setBatchCurrentAgentState = (agentId, stateName) => {
    const card = document.querySelector(`[data-batch-agent="${agentId}"]`);
    const status = document.querySelector(`[data-batch-agent-status="${agentId}"]`);
    if (!card || !status) return;

    card.classList.remove("active", "done", "error");

    const stateByName = {
      wait: {
        cardClass: "",
        statusClass: "agent-status s-wait",
        text: "en attente",
      },
      active: {
        cardClass: "active",
        statusClass: "agent-status s-run",
        text: "⟳ génération...",
      },
      done: {
        cardClass: "done",
        statusClass: "agent-status s-done",
        text: "✓ done",
      },
      error: {
        cardClass: "error",
        statusClass: "agent-status s-err",
        text: "✗ erreur",
      },
      stopped: {
        cardClass: "error",
        statusClass: "agent-status s-err",
        text: "⏹ stoppé",
      },
    };

    const nextState = stateByName[stateName] || stateByName.wait;
    if (nextState.cardClass) card.classList.add(nextState.cardClass);
    status.className = nextState.statusClass;
    status.textContent = nextState.text;
  };

  let batchState = createInitialBatchState();
  let batchImages = {};
  function showBatchCountPicker() {
    const container = document.getElementById("batchFiches");
    const picker = document.createElement("div");
    picker.id = "batchCountPicker";
    picker.style.cssText =
      "background:var(--surface);border:2px dashed var(--border);border-radius:12px;padding:28px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;";
    picker.innerHTML =
      "<label style=\"font-size:12px;color:var(--muted);font-family:'Space Mono',monospace;\">Nombre de fiches (min 2) :</label>" +
      '<input type="number" id="batchCountInline" min="2" max="20" value="2" style="width:70px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 10px;font-family:\'Space Mono\',monospace;font-size:14px;text-align:center;"/>' +
      '<button class="run-btn" style="width:auto;padding:10px 24px;" onclick="initBatchInline()">▶ Créer les fiches</button>';
    container.parentNode.insertBefore(picker, container);
  }
  function initBatchInline() {
    batchState = createInitialBatchState();
    batchImages = {};
    setBatchWrapperPhase("setup");
    resetBatchCurrentPipeline();

    const count = parseInt(document.getElementById("batchCountInline").value);
    if (isNaN(count) || count < 2) {
      showToast("Minimum 2 fiches", "#ff4757");
      return;
    }
    // Remove picker
    const picker = document.getElementById("batchCountPicker");
    if (picker) picker.remove();
    // Init fiches
    const container = document.getElementById("batchFiches");
    container.innerHTML = "";
    const mode = currentMode;
    const isTT = mode === "tabletop";
    for (let i = 0; i < count; i++) {
      batchState.fiches.push({
        id: i,
        nom: "",
        sculpteur: "",
        outputs: {},
        cost: 0,
      });
      batchImages[i] = [];
      container.appendChild(buildBatchFiche(i, isTT));
    }
    const existing = document.getElementById("batchRunBtn");
    if (existing) existing.remove();
    const runBtn = document.createElement("button");
    runBtn.id = "batchRunBtn";
    runBtn.className = "batch-run-btn";
    runBtn.textContent = "⚡ Lancer le batch";
    runBtn.onclick = startBatch;
    container.appendChild(runBtn);
  }
  function openBatchModal() {
    const m = document.getElementById("batchModal");
    document.body.appendChild(m);
    m.classList.add("visible");
  }
  function closeBatchModal() {
    document.getElementById("batchModal").classList.remove("visible");
  }
  function initBatch() {
    const count = parseInt(document.getElementById("batchCount").value);
    if (isNaN(count) || count < 2) {
      showToast("Minimum 2 fiches", "#ff4757");
      return;
    }
    closeBatchModal();
    // Switch mode si batch déclenché depuis home
    if (_pendingBatchMode && _pendingBatchMode !== currentMode)
      switchMode(_pendingBatchMode);
    _pendingBatchMode = null;
    batchState = createInitialBatchState();
    batchImages = {};
    setBatchWrapperPhase("setup");
    resetBatchCurrentPipeline();
    const container = document.getElementById("batchFiches");
    container.innerHTML = "";
    document.getElementById("batchExportBtn").classList.remove("visible");
    document.getElementById("batchProgress").classList.remove("visible");
    global.moveBatchWrapperToForm?.();
    // Update form header label
    const label = document.getElementById("formModeLabel");
    if (label)
      label.textContent =
        currentMode === "tabletop"
          ? "⚡ Batch Tabletop"
          : "⚡ Batch Collection";
    // Hide ui-tt / ui-col
    document.getElementById("ui-tt")?.style &&
      (document.getElementById("ui-tt").style.display = "none");
    document.getElementById("ui-col")?.style &&
      (document.getElementById("ui-col").style.display = "none");
    const mode = currentMode;
    const isTT = mode === "tabletop";
    for (let i = 0; i < count; i++) {
      batchState.fiches.push({
        id: i,
        nom: "",
        sculpteur: "",
        outputs: {},
        cost: 0,
      });
      batchImages[i] = [];
      container.appendChild(buildBatchFiche(i, isTT));
    }
    const existing = document.getElementById("batchRunBtn");
    if (existing) existing.remove();
    const runBtn = document.createElement("button");
    runBtn.id = "batchRunBtn";
    runBtn.className = "batch-run-btn";
    runBtn.textContent = "⚡ Lancer le batch";
    runBtn.onclick = startBatch;
    container.appendChild(runBtn);
    // Navigate to view-form
    showView("form");
  }
  function buildBatchFiche(i, isTT) {
    const d = document.createElement("div");
    d.className = "batch-fiche";
    d.id = `batch-fiche-${i}`;

    const eList = isTT
      ? [
          "28mm",
          "32mm",
          "50mm",
          "54mm",
          "75mm",
          "90mm",
          "120mm",
          "140mm",
          "1/10",
          "1/8",
          "1/6",
        ]
      : ["140mm", "1/12", "1/10", "1/9", "1/8", "1/7", "1/6"];

    let echHtml = eList
      .map(
        (e, j) => `
    <div class="ech-item" id="b${i}-ei${j}">
      <input type="checkbox" id="b${i}-ec${j}" onchange="batchToggleEch(${i},${j})">
      <span class="ech-label">${e}</span>
      <input type="text" id="b${i}-ed${j}" placeholder="dim" disabled>
    </div>`,
      )
      .join("");

    if (!isTT) {
      for (let c = 0; c < 3; c++) {
        const idx = eList.length + c;
        echHtml += `
    <div class="ech-item" id="b${i}-ei${idx}">
      <input type="checkbox" id="b${i}-ec${idx}" onchange="batchToggleEch(${i},${idx})">
      <input type="text" id="b${i}-elabel${idx}" placeholder="ex: 1/5" style="flex:0 0 52px;background:transparent;border:none;border-right:1px solid var(--border);padding:0 6px;font-size:11px;font-family:'Space Mono',monospace;color:var(--text);">
      <input type="text" id="b${i}-ed${idx}" placeholder="dim" disabled>
    </div>`;
      }
    }

    const archSecTT = [
      "monk",
      "warrior",
      "mage",
      "rogue",
      "ranger",
      "paladin",
      "barbarian",
      "cleric",
      "druid",
      "bard",
      "fighter",
      "necromancer",
      "martial artist",
      "kung fu",
      "assassin",
      "archer",
      "berserker",
      "wizard",
      "warlock",
      "dragonborn",
    ]
      .map(
        (v) =>
          `<label class="social-check"><input type="checkbox" value="${v}"/> ${v}</label>`,
      )
      .join("");

    const mediumCOL = [
      ["anime", "📺 Anime"],
      ["manga", "📖 Manga"],
      ["jeux vidéo", "🎮 Jeux vidéo"],
      ["comics / super-héros", "🦸 Comics"],
      ["cinéma / série", "🎬 Cinéma / Série"],
      ["animation occidentale", "🎨 Animation"],
      ["donjons & dragons / fantasy", "🐉 Fantasy"],
      ["création originale", "✨ Original"],
    ]
      .map(
        ([v, l]) =>
          `<label class="social-check"><input type="checkbox" value="${v}"/> ${l}</label>`,
      )
      .join("");

    const imgSection = `
    <div class="form-full-row">
      <div class="drop-zone" id="b${i}-dropZone">
        <div class="dz-placeholder" id="b${i}-dzPlaceholder">
          <div class="di">🖼️</div>
          <p>Glisse tes images ici ou clique pour choisir (max 4)</p>
        </div>
        <div class="thumb-strip" id="b${i}-thumbStrip"></div>
        <input type="file" id="b${i}-imgInput" multiple accept="image/*" style="display:none">
      </div>
    </div>`;

    const prodTT = `
    <div class="form-2col">
      <div class="form-col-left">
        <div class="form-section"><h2>Identité</h2><div class="form-grid">
          <div class="fg"><label>Nom court <span class="fg-hint">→ titres &amp; tags</span></label>
            <input type="text" id="b${i}-fNomCourt" placeholder="ex: Jingwey"
              oninput="document.getElementById('batch-title-${i}').textContent='📦 '+(this.value||'Fiche ${i + 1}')">
          </div>
          <div class="fg"><label>Intitulé complet <span class="fg-hint">→ description</span></label><input type="text" id="b${i}-fNom" placeholder="ex: Jingwey the Monk"></div>
          <div class="fg"><label>Univers</label><input type="text" id="b${i}-fUnivers" placeholder="ex: Fantasy"></div>
          <div class="fg"><label>Sculpteur</label><input type="text" id="b${i}-fSculpteur" placeholder="ex: Nerikson"></div>
          <div class="fg"><label>Nb pièces</label><input type="text" id="b${i}-fPieces" placeholder="ex: 10 pcs"></div>
        </div></div>
        <div class="form-section"><h2>Archétypes</h2><div class="form-grid">
          <div class="fg full"><label>Principal <span class="fg-hint">→ tags &amp; titres</span></label>
            <select id="b${i}-fArchPrincipal">
              <option value="">— Choisir —</option>
              <option value="monk">Monk / Moine</option><option value="warrior">Warrior / Guerrier</option>
              <option value="mage">Mage / Sorcerer</option><option value="rogue">Rogue / Assassin</option>
              <option value="ranger">Ranger / Archer</option><option value="paladin">Paladin</option>
              <option value="barbarian">Barbarian / Berserker</option><option value="cleric">Cleric / Priest</option>
              <option value="druid">Druid</option><option value="bard">Bard</option>
              <option value="fighter">Fighter</option><option value="necromancer">Necromancer</option>
              <option value="artificer">Artificer</option><option value="creature">Creature / Monster</option>
            </select>
          </div>
          <div class="fg full"><label>Secondaires <span class="fg-hint">→ couverture sémantique</span></label>
            <div id="b${i}-archSecondaires" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">${archSecTT}</div>
          </div>
          <div class="fg full"><label>SEO élargis <span class="fg-hint">→ séparés par virgules</span></label>
            <input type="text" id="b${i}-fArchSeo" placeholder="ex: elf warrior, dark knight">
          </div>
        </div></div>
      </div>
      <div class="form-col-right">
        <div class="form-section"><h2>Paramètres</h2><div class="form-grid">
          <div class="fg"><label>Pose</label><select id="b${i}-fPose"><option value="MUSEUM">Museum</option><option value="DYNAMIQUE">Dynamique</option></select></div>
          <div class="fg"><label>Type produit</label><select id="b${i}-fType"><option value="SOLO">Solo</option><option value="SET">Set / Armée</option><option value="BOSS">Boss / Créature</option></select></div>
          <div class="fg full"><label>Version</label><select id="b${i}-fVersion"><option value="FIGURINE">Figurine</option><option value="MINIATURES">Miniatures</option><option value="LES_DEUX">Figurine et Miniatures</option></select></div>
        </div></div>
        <div class="form-section"><h2>Échelles + dimensions</h2>
          <div class="echelles-grid" id="b${i}-echellesGrid">${echHtml}</div>
        </div>
        <details class="form-section form-optional">
          <summary class="form-optional-toggle">Options avancées <span class="fg-hint">buzz · notes</span></summary>
          <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px;">
            <div class="fg"><label>Buzz actuel</label>
              <div class="buzz-row">
                <input type="checkbox" id="b${i}-fBuzz" onchange="document.getElementById('b${i}-fBuzzNote').classList.toggle('visible',this.checked)">
                <span>Ce personnage buzz en ce moment</span>
              </div>
              <textarea id="b${i}-fBuzzNote" class="buzz-note" placeholder="Contexte buzz..."></textarea>
            </div>
            <div class="fg"><label>Notes libres</label><textarea id="b${i}-fNotes" placeholder="Infos supplémentaires..."></textarea></div>
          </div>
        </details>
      </div>
    </div>`;

    const prodCOL = `
    <div class="form-2col">
      <div class="form-col-left">
        <div class="form-section"><h2>Identité</h2><div class="form-grid">
          <div class="fg"><label>Nom court <span class="fg-hint">→ titres &amp; tags</span></label>
            <input type="text" id="b${i}-fNomCourt" placeholder="ex: Leon Kennedy"
              oninput="document.getElementById('batch-title-${i}').textContent='📦 '+(this.value||'Fiche ${i + 1}')">
          </div>
          <div class="fg"><label>Intitulé complet <span class="fg-hint">→ description</span></label><input type="text" id="b${i}-fNom" placeholder="ex: Leon Kennedy – RE Requiem"></div>
          <div class="fg"><label>Univers</label><input type="text" id="b${i}-fUnivers" placeholder="ex: Resident Evil"></div>
          <div class="fg"><label>Sculpteur</label><input type="text" id="b${i}-fSculpteur" placeholder="ex: Neko Figurines"></div>
          <div class="fg"><label>Nb pièces</label><input type="text" id="b${i}-fPieces" placeholder="ex: 22 pcs"></div>
          <div class="fg"><label>Pose</label><select id="b${i}-fPose"><option value="MUSEUM">Museum</option><option value="DYNAMIQUE">Dynamique</option></select></div>
          <div class="fg full"><label>License protégée <span class="fg-hint">→ droits auteur</span></label>
            <label class="social-check" style="margin-top:4px;">
              <input type="checkbox" id="b${i}-fLicense"
                onchange="document.getElementById('b${i}-licenseLabel').textContent=this.checked?'Oui — décrire via le medium':'Non — nommer librement'">
              <span id="b${i}-licenseLabel">Non — nommer librement le personnage et l'univers</span>
            </label>
          </div>
          <div class="fg full"><label>Medium <span class="fg-hint">→ tags &amp; SEO</span></label>
            <div id="b${i}-fMediumGroup" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">${mediumCOL}</div>
          </div>
        </div></div>
        <div class="form-section"><h2>Personnage</h2><div class="form-grid">
          <div class="fg full"><label>Particularités <span class="fg-hint">→ variantes, FX</span></label>
            <textarea id="b${i}-fParticularites" placeholder="ex: 2 designs, FX résine translucide..." style="min-height:55px;"></textarea>
          </div>
          <div class="fg full"><label>Contexte personnage <span class="fg-hint">→ analyse Jules</span></label>
            <textarea id="b${i}-fContextePerso" placeholder="Résumé du personnage, univers..." style="min-height:70px;"></textarea>
          </div>
        </div></div>
      </div>
      <div class="form-col-right">
        <div class="form-section"><h2>Buzz marché</h2><div class="form-grid">
          <div class="fg full"><label>Licence / Univers en buzz <span class="fg-hint">→ analyse marché</span></label>
            <div class="buzz-row">
              <input type="checkbox" id="b${i}-fBuzzCollection"
                onchange="document.getElementById('b${i}-fBuzzCollectionNote').classList.toggle('visible',this.checked)">
              <span>Licence ou univers récent, potentiel sous-évalué</span>
            </div>
            <textarea id="b${i}-fBuzzCollectionNote" class="buzz-note" placeholder="Sortie récente, film/série/jeu qui buzz..."></textarea>
          </div>
        </div></div>
        <div class="form-section"><h2>Échelles + dimensions</h2>
          <div class="echelles-grid" id="b${i}-echellesGrid">${echHtml}</div>
        </div>
        <details class="form-section form-optional">
          <summary class="form-optional-toggle">Options avancées <span class="fg-hint">notes</span></summary>
          <div style="margin-top:16px;">
            <div class="fg"><label>Notes libres</label><textarea id="b${i}-fNotes" placeholder="Infos supplémentaires..."></textarea></div>
          </div>
        </details>
      </div>
    </div>`;

    d.innerHTML = `
    <div class="batch-fiche-header">
      <span class="batch-fiche-title" id="batch-title-${i}">📦 Fiche ${i + 1}</span>
      <span class="batch-fiche-status" id="batch-status-${i}">en attente</span>
    </div>
    ${imgSection}
    ${isTT ? prodTT : prodCOL}`;

    setTimeout(() => {
      const dz = document.getElementById(`b${i}-dropZone`);
      const inp = document.getElementById(`b${i}-imgInput`);
      if (dz && inp) {
        dz.onclick = () => inp.click();
        dz.ondragover = (e) => {
          e.preventDefault();
          dz.classList.add("dragover");
        };
        dz.ondragleave = () => dz.classList.remove("dragover");
        dz.ondrop = (e) => {
          e.preventDefault();
          dz.classList.remove("dragover");
          batchAddImages(i, Array.from(e.dataTransfer.files));
        };
        inp.onchange = (e) => batchAddImages(i, Array.from(e.target.files));
      }
    }, 0);

    return d;
  }
  function batchToggleEch(i, j) {
    const cb = document.getElementById("b" + i + "-ec" + j);
    const dim = document.getElementById("b" + i + "-ed" + j);
    if (dim) dim.disabled = !cb.checked;
  }
  function batchAddImages(i, files) {
    const MAX = 4;
    const thumbs = document.getElementById("b" + i + "-thumbStrip");
    const placeholder = document.getElementById("b" + i + "-dzPlaceholder");
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (batchImages[i].length >= MAX) return;
      resizeImage(file, 512).then((b64) => {
        if (batchImages[i].length >= MAX) return;
        batchImages[i].push({
          name: file.name,
          base64: b64,
          mediaType: "image/jpeg",
        });
        // Hide placeholder
        if (placeholder) placeholder.style.display = "none";
        // Add thumb with ✕ button
        if (thumbs) {
          const wrap = document.createElement("div");
          wrap.style.cssText = "position:relative;display:inline-block;";
          const img = document.createElement("img");
          img.src = "data:image/jpeg;base64," + b64;
          img.className = "img-thumb";
          img.title = file.name;
          const btn = document.createElement("button");
          btn.textContent = "✕";
          btn.style.cssText =
            "position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--error);border:none;color:#fff;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;z-index:2;";
          btn.onclick = (e) => {
            e.stopPropagation();
            batchImages[i] = batchImages[i].filter((im) => im.base64 !== b64);
            wrap.remove();
            if (batchImages[i].length === 0 && placeholder)
              placeholder.style.display = "";
          };
          wrap.appendChild(img);
          wrap.appendChild(btn);
          thumbs.appendChild(wrap);
        }
      });
    });
  }
  function isBatchRunning() {
    return !!batchState.running;
  }

  function stopBatch(options = {}) {
    const { silent = false } = options;
    batchState.stopped = true;
    batchState.stoppedByUser = true;
    batchState.lastError = "";

    const controllers = global.abortControllers || {};
    Object.keys(controllers).forEach((agentId) => {
      const controller = controllers[agentId];
      if (controller) controller.abort();
      delete controllers[agentId];
    });

    if (!silent && batchState.running) showToast("⏹ Batch stoppé", "#ff4757");
  }
  async function startBatch() {
    const apiKey = document.getElementById("apiKey").value.trim();
    if (!apiKey) {
      showToast("Clé API manquante", "#ff4757");
      return;
    }
    for (let i = 0; i < batchState.fiches.length; i++) {
      const nom = document
        .getElementById("b" + i + "-fNomCourt")
        ?.value?.trim();
      if (!nom) {
        showToast("Fiche " + (i + 1) + " : nom manquant", "#ff4757");
        return;
      }
      if (!batchImages[i] || batchImages[i].length === 0) {
        showToast("Fiche " + (i + 1) + " : images manquantes", "#ff4757");
        return;
      }
    }

    const timeline = document.getElementById("pipelineTimeline");
    if (timeline) timeline.style.display = "";

    const title = document.getElementById("pipelineViewTitle");
    if (title)
      title.textContent =
        currentMode === "tabletop"
          ? "⚡ Batch Tabletop"
          : "⚡ Batch Collection";

    batchState.running = true;
    batchState.stopped = false;
    batchState.stoppedByUser = false;
    batchState.lastError = "";

    setBatchWrapperPhase("running");
    global.moveBatchWrapperToPipeline?.();
    showView("pipeline");
    global.syncHeaderBackAction?.();
    const runBtn = document.getElementById("batchRunBtn");
    if (runBtn) runBtn.disabled = true;
    document.getElementById("batchProgress").classList.add("visible");
    const total = batchState.fiches.length;
    const agents = getPipelineAgents();
    for (let i = 0; i < total; i++) {
      if (batchState.stopped) break;
      batchState.current = i;
      global.buildPipelineTimeline?.(`Fiche ${i + 1}/${total}`);
      agents.forEach((agent) => global.updatePipelineTimeline?.(agent.id, "wait"));
      renderBatchCurrentPipeline(i, total, agents);

      const ficheEl = document.getElementById("batch-fiche-" + i);
      ficheEl.classList.add("running");
      document.getElementById("batch-status-" + i).textContent =
        "⟳ en cours...";
      updateBatchProgress(i + 1, total, 0, agents.length, 1);
      const ok = await runBatchFiche(i, agents);
      ficheEl.classList.remove("running");
      if (!ok) {
        if (batchState.stoppedByUser) {
          document.getElementById("batch-status-" + i).textContent = "⏹ stoppée";
          break;
        }

        ficheEl.classList.add("error");
        const detail = batchState.lastError || "erreur inconnue";
        document.getElementById("batch-status-" + i).textContent = "❌ erreur";
        batchState.stopped = true;
        showToast("❌ Fiche " + (i + 1) + " — " + detail, "#ff4757", 5000);
        break;
      }
      ficheEl.classList.add("done");
      document.getElementById("batch-status-" + i).textContent = "✅ terminée";
    }
    batchState.running = false;
    document.getElementById("batchProgress").classList.remove("visible");
    if (runBtn) {
      runBtn.disabled = false;
    }
    global.syncHeaderBackAction?.();
    if (!batchState.stopped) {
      const exportBtn = document.getElementById("batchExportBtn");
      exportBtn.classList.add("visible");
      exportBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("✅ Batch terminé !", "#4caf7d");
    }
  }
  function updateBatchProgress(
    ficheNum,
    ficheTotal,
    completedAgents,
    agentTotal,
    currentAgentNum = completedAgents,
  ) {
    const pct =
      ((ficheNum - 1) / ficheTotal + completedAgents / agentTotal / ficheTotal) *
      100;
    document.getElementById("batchProgressLabel").textContent =
      "Fiche " +
      ficheNum +
      "/" +
      ficheTotal +
      " — Agent " +
      currentAgentNum +
      "/" +
      agentTotal;
    document.getElementById("batchProgressBar").style.width = pct + "%";
  }
  function getBatchCtx(i) {
    const isTT = currentMode === "tabletop";
    const get = (id) => document.getElementById(id)?.value?.trim() || "";
    const getCheck = (id) => document.getElementById(id)?.checked || false;

    const nom = get("b" + i + "-fNom") || get("b" + i + "-fNomCourt");
    const nomCourt = get("b" + i + "-fNomCourt") || nom.split(" ")[0];

    // Echelles + dims
    const eList = isTT
      ? [
          "28mm",
          "32mm",
          "50mm",
          "54mm",
          "75mm",
          "90mm",
          "120mm",
          "140mm",
          "1/10",
          "1/8",
          "1/6",
        ]
      : ["140mm", "1/12", "1/10", "1/9", "1/8", "1/7", "1/6"];
    const echSel = [];
    const dimLines = [];
    eList.forEach((e, j) => {
      if (getCheck("b" + i + "-ec" + j)) {
        echSel.push(e);
        const dim = get("b" + i + "-ed" + j);
        if (dim) dimLines.push(e + " ⇒ " + dim);
      }
    });
    if (!isTT) {
      for (let c = 0; c < 3; c++) {
        const idx = eList.length + c;
        if (getCheck("b" + i + "-ec" + idx)) {
          const label = get("b" + i + "-elabel" + idx);
          const dim = get("b" + i + "-ed" + idx);
          if (label) {
            echSel.push(label);
            if (dim) dimLines.push(label + " ⇒ " + dim);
          }
        }
      }
    }

    // Archetypes TT
    const archPrincipal = isTT ? get("b" + i + "-fArchPrincipal") : "";
    const archSecEl = document.getElementById("b" + i + "-archSecondaires");
    const archSec = archSecEl
      ? [...archSecEl.querySelectorAll("input:checked")].map((cb) => cb.value)
      : [];
    const archSeo = isTT ? get("b" + i + "-fArchSeo") : "";
    const archetypesParts = [];
    if (archPrincipal) archetypesParts.push("Principal: " + archPrincipal);
    if (archSec.length)
      archetypesParts.push("Secondaires: " + archSec.join(", "));
    if (archSeo) archetypesParts.push("SEO: " + archSeo);

    // Medium COL
    const mediumEl = document.getElementById("b" + i + "-fMediumGroup");
    const medium = mediumEl
      ? [...mediumEl.querySelectorAll("input:checked")]
          .map((cb) => cb.value)
          .join(", ")
      : "";

    // Buzz
    const buzz = getCheck("b" + i + "-fBuzz");
    const buzzNote = get("b" + i + "-fBuzzNote");

    return {
      nom: nom.replace(/\b\w/g, (c) => c.toUpperCase()),
      nomCourt: nomCourt.replace(/\b\w/g, (c) => c.toUpperCase()),
      univers: get("b" + i + "-fUnivers"),
      sculpteur: get("b" + i + "-fSculpteur") || "Inconnu",
      pieces: get("b" + i + "-fPieces"),
      echelles: echSel.join(", "),
      dimensions: dimLines.join("\n"),
      pose: get("b" + i + "-fPose") || "MUSEUM",
      notes: get("b" + i + "-fNotes"),
      archetypes: archetypesParts.join(" | "),
      type: isTT ? get("b" + i + "-fType") || "SOLO" : "",
      version: isTT ? get("b" + i + "-fVersion") || "FIGURINE" : "",
      buzz: isTT ? buzz : false,
      buzzNote: isTT ? buzzNote : "",
      medium,
      license: getCheck("b" + i + "-fLicense") ? "oui" : "non",
      particularites: get("b" + i + "-fParticularites"),
      contextePerso: get("b" + i + "-fContextePerso"),
      lienPerso: "",
      buzzCollection: !isTT ? buzz : false,
      buzzCollectionNote: !isTT ? buzzNote : "",
      outputs: state.outputs,
      rules: "",
      url_boutique: "https://grosgeekindustrie.etsy.com",
      social_formats: "",
      selectedAccrocheText: "",
      selectedCTAText: "",
      profil_dominant: "collectionneur",
      imageCount: (batchImages[i] || []).length,
    };
  }
  async function runBatchFiche(i, agents = getPipelineAgents()) {
    const savedOutputs = { ...state.outputs };
    const savedImages = { ...state.images };
    state.outputs = {};
    state.images[pfx()] = batchImages[i] || [];

    for (let a = 0; a < agents.length; a++) {
      if (batchState.stopped) {
        state.outputs = savedOutputs;
        state.images = savedImages;
        return false;
      }
      updateBatchProgress(
        batchState.current + 1,
        batchState.fiches.length,
        a,
        agents.length,
        a + 1,
      );
      const ctx = getBatchCtx(i);
      const agent = agents[a];
      ctx.outputs = { ...state.outputs };
      global.updatePipelineTimeline?.(agent.id, "active");
      setBatchCurrentAgentState(agent.id, "active");
      const ok = await runBatchAgent(agent, ctx);
      if (!ok) {
        global.updatePipelineTimeline?.(
          agent.id,
          batchState.stoppedByUser ? "wait" : "error",
        );
        setBatchCurrentAgentState(
          agent.id,
          batchState.stoppedByUser ? "stopped" : "error",
        );
        state.outputs = savedOutputs;
        state.images = savedImages;
        return false;
      }
      global.updatePipelineTimeline?.(agent.id, "done");
      setBatchCurrentAgentState(agent.id, "done");
      updateBatchProgress(
        batchState.current + 1,
        batchState.fiches.length,
        a + 1,
        agents.length,
        a + 1,
      );

      if (agent.id === "titre") {
        const titreOut = state.outputs["titre"] || "";
        const line = titreOut.split("\n").find((l) => /^\d+\.\s+/.test(l));
        state.outputs["titre_valide"] = line
          ? line
              .replace(/^\d+\.\s*/, "")
              .replace(/\s*\(\d+\s*car[^)]*\)/i, "")
              .trim()
          : "";
      }
      if (agents[a].id === "description") {
        const out = state.outputs["description"] || "";
        const accroches = parseChoices(out, "A");
        const ctas = parseChoices(out, "C");
        const newLines = out.split("\n").map((l) => {
          if (/^A\d+→/.test(l) && accroches[0]) return accroches[0].text;
          if (/^C\d+→/.test(l) && ctas[0]) return ctas[0].text;
          return l;
        });
        state.outputs["description_assembled"] = newLines.join("\n");
      }
    }

    batchState.fiches[i].nom =
      document.getElementById("b" + i + "-fNomCourt")?.value?.trim() ||
      "figurine";
    batchState.fiches[i].sculpteur =
      document.getElementById("b" + i + "-fSculpteur")?.value?.trim() ||
      "sculpteur";
    batchState.fiches[i].outputs = { ...state.outputs };
    state.outputs = savedOutputs;
    state.images = savedImages;
    return true;
  }
  async function runBatchAgent(agent, ctx) {
    try {
      // CAS SPÉCIAL TAGS = flow 3 agents internes
      if (agent.id === "tags") {
        const { output, debug } = await runTagsThreeAgents(ctx);

        state.outputs.tags = output;
        state.inputs.tags = [
          "===== TAGS EXPLORE =====",
          debug.explore || "",
          "",
          "===== TAGS FILTER =====",
          debug.filter || "",
          "",
          "===== TAGS SELECT =====",
          debug.select || "",
        ].join("\n");

        return true;
      }

      const template = state.promptsByMode[currentMode][agent.id] || "";
      const filled = template
        .replace(/\[\[NOM_COURT\]\]/g, ctx.nomCourt)
        .replace(/\[\[NOM\]\]/g, ctx.nom)
        .replace(/\[\[UNIVERS\]\]/g, ctx.univers || "")
        .replace(/\[\[SCULPTEUR\]\]/g, ctx.sculpteur)
        .replace(/\[\[ECHELLES\]\]/g, ctx.echelles)
        .replace(/\[\[PIECES\]\]/g, ctx.pieces)
        .replace(/\[\[DIMENSIONS\]\]/g, ctx.dimensions || "")
        .replace(/\[\[POSE\]\]/g, ctx.pose || "")
        .replace(/\[\[VERSION\]\]/g, ctx.version || "")
        .replace(/\[\[TYPE\]\]/g, ctx.type || "")
        .replace(
          /\[\[BUZZ\]\]/g,
          ctx.buzz ? "OUI" + (ctx.buzzNote ? " — " + ctx.buzzNote : "") : "NON",
        )
        .replace(/\[\[ANALYSE\]\]/g, ctx.outputs.analyse || "")
        .replace(/\[\[MARCHE\]\]/g, ctx.outputs.marche || "")
        .replace(/\[\[TAGS\]\]/g, ctx.outputs.tags || "")
        .replace(/\[\[TITRE_VALIDE\]\]/g, ctx.outputs.titre_valide || "")
        .replace(
          /\[\[DESCRIPTION\]\]/g,
          ctx.outputs.description_assembled || ctx.outputs.description || "",
        )
        .replace(/\[\[ARCHETYPES\]\]/g, ctx.archetypes || "")
        .replace(/\[\[OBJECTIF\]\]/g, getBiblio("objectif"))
        .replace(/\[\[PSYCHO\]\]/g, getBiblio("psycho"))
        .replace(
          /\[\[BIBLIO_SEMANTIQUE\]\]/g,
          getBiblio("bibliotheque-semantique"),
        )
        .replace(/\[\[BIBLIO_TITRES\]\]/g, getBiblio("titres"))
        .replace(
          /\[\[BIBLIO_TAGS\]\]/g,
          getBiblioTagsFormatted() || "_(aucun retour enregistré)_",
        )
        .replace(/\[\[MEDIUM\]\]/g, ctx.medium || "")
        .replace(/\[\[LICENSE\]\]/g, ctx.license || "non")
        .replace(/\[\[PARTICULARITES\]\]/g, ctx.particularites || "")
        .replace(/\[\[CONTEXTE_PERSO\]\]/g, ctx.contextePerso || "")
        .replace(/\[\[LIEN_PERSO\]\]/g, ctx.lienPerso || "")
        .replace(
          /\[\[BUZZ_COLLECTION\]\]/g,
          ctx.buzzCollection
            ? "OUI" +
                (ctx.buzzCollectionNote ? " — " + ctx.buzzCollectionNote : "")
            : "NON",
        )
        .replace(/\[\[NOTES\]\]/g, ctx.notes || "")
        .replace(/\[\[URL\]\]/g, ctx.url_boutique || "")
        .replace(/\[\[SOCIAL_FORMATS\]\]/g, ctx.social_formats || "")
        .replace(/\[\[ACCROCHE\]\]/g, ctx.selectedAccrocheText || "")
        .replace(/\[\[CTA\]\]/g, ctx.selectedCTAText || "")
        .replace(/\[\[PROFIL_DOMINANT\]\]/g, ctx.profil_dominant || "");

      const fixedBuilder =
        typeof CACHE_FIXED !== "undefined" &&
        CACHE_FIXED &&
        typeof CACHE_FIXED[agent.id] === "function"
          ? CACHE_FIXED[agent.id]
          : null;

      const fixedContent = fixedBuilder ? fixedBuilder() : null;

      state.inputs[agent.id] = filled;

      const { text: result, usage } = await callClaude(
        agent.id,
        { filled, fixedContent },
        agent.usesImages,
      );
      state.outputs[agent.id] = result;

      if (usage) {
        const isH = (AGENT_MODELS[agent.id] || "").includes("haiku");
        const P = isH
          ? {
              input: 0.8 / 1e6,
              cacheWrite: 1 / 1e6,
              cacheRead: 0.08 / 1e6,
              output: 4 / 1e6,
            }
          : {
              input: 3 / 1e6,
              cacheWrite: 3.75 / 1e6,
              cacheRead: 0.3 / 1e6,
              output: 15 / 1e6,
            };
        const r = usage.cache_read_input_tokens || 0,
          w = usage.cache_creation_input_tokens || 0,
          n = (usage.input_tokens || 0) - r - w;
        state.sessionCost +=
          (n * P.input +
            w * P.cacheWrite +
            r * P.cacheRead +
            (usage.output_tokens || 0) * P.output) *
          100;
        const sessionEl = document.getElementById("session-cost");
        if (sessionEl)
          sessionEl.textContent = "💰 " + state.sessionCost.toFixed(2) + "¢";
      }

      return true;
    } catch (e) {
      batchState.lastError = agent.id + " — " + e.message;
      console.error("Batch agent error", agent.id, e.message);

      return false;
    }
  }
  async function exportBatch() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateFR =
      pad(now.getDate()) + pad(now.getMonth() + 1) + now.getFullYear();
    const heureFR = pad(now.getHours()) + pad(now.getMinutes());
    const mode = currentMode;
    const files = [];

    for (const fiche of batchState.fiches) {
      if (!fiche.outputs || !Object.keys(fiche.outputs).length) continue;
      const nom = (fiche.nom || "figurine").replace(/[^\w\-]/g, "_");
      const sc = (fiche.sculpteur || "sculpteur").replace(/[^\w\-]/g, "_");
      const base = nom + "_" + sc + "_" + dateFR + "_" + heureFR;
      const subdir = "batch/" + mode + "/";

      // ── Fiche complete — copier-coller Etsy ──
      const complete = [
        "# " + fiche.nom,
        "",
        "## 🏷️ Titre",
        fiche.outputs.titre_valide || "",
        "",
        "## 🔖 Tags",
        fiche.outputs.tags || "",
        "",
        "## 📝 Description",
        fiche.outputs.description_assembled || fiche.outputs.description || "",
        "",
        "## 🖼️ Balise ALT",
        fiche.outputs.alt || "",
      ].join("\n");
      files.push({
        filename: subdir + base + "_complete.md",
        content: complete,
      });

      // ── Fiche raw — tous les outputs agents ──
      const agentLabels =
        mode === "tabletop"
          ? {
              analyse: "01 Jules/Marcus — Analyse visuelle",
              alt: "02 Nadia/Iris — Balise ALT",
              marche: "03 Sophie/Luna — Analyse marché",
              tags: "04 Karim/Axel — Tags",
              titre: "05 Maya/Nova — Titres",
              titre_valide: "05b Titre validé",
              description: "06 Claire/Eden — Description brute",
              description_assembled: "06b Description assemblée",
            }
          : {
              analyse: "01 Jules — Analyse visuelle",
              alt: "02 Iris — Balise ALT",
              marche: "03 Luna — Analyse marché",
              tags: "04 Axel — Tags",
              titre: "05 Nova — Titres",
              titre_valide: "05b Titre validé",
              description: "06 Eden — Description brute",
              description_assembled: "06b Description assemblée",
            };
      const rawParts = ["# " + fiche.nom + " — RAW", ""];
      for (const [key, label] of Object.entries(agentLabels)) {
        const val = fiche.outputs[key];
        if (val) rawParts.push("## " + label + "\n" + val + "\n");
      }
      files.push({
        filename: subdir + base + "_raw.md",
        content: rawParts.join("\n"),
      });
    }

    // ── Rapport global ──
    const rapport = [
      "# Rapport Batch",
      "Date : " + dateFR + " " + heureFR,
      "Mode : " + mode,
      "Fiches : " + files.length / 2,
      "Coût session : " + state.sessionCost.toFixed(3) + "¢",
      "",
      "## Fichiers exportés",
      ...files.map((f) => "- " + f.filename),
    ].join("\n");
    files.push({
      filename:
        "batch/" + mode + "/rapport_batch_" + dateFR + "_" + heureFR + ".md",
      content: rapport,
    });

    try {
      const res = await fetch("/batch/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(
        "✅ Exporté dans batch/" +
          mode +
          "/ — " +
          Math.floor(files.length / 2) +
          " fiche(s)",
        "#4caf7d",
        5000,
      );
    } catch (e) {
      showToast("Erreur export: " + e.message, "#ff4757", 5000);
    }
  }

  global.PipelineUIBatch = {
    showBatchCountPicker,
    initBatchInline,
    openBatchModal,
    closeBatchModal,
    initBatch,
    buildBatchFiche,
    batchToggleEch,
    batchAddImages,
    isBatchRunning,
    stopBatch,
    startBatch,
    updateBatchProgress,
    getBatchCtx,
    runBatchFiche,
    runBatchAgent,
    exportBatch,
  };

  global.PipelineUI.batch = global.PipelineUI.batch || {};
  Object.assign(global.PipelineUI.batch, global.PipelineUIBatch);
  Object.assign(global, global.PipelineUIBatch);
})(window);
