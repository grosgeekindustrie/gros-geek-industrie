// --- PIPELINE API ---

// Frontiere runtime pipeline residuelle.
// Les appels Anthropic, agents, sorties, social, Iris et reporting vivent maintenant dans
// des modules runtime dedies. Ce fichier garde surtout les helpers de ciblage/runtime
// pipeline encore partages.

// ═══════════════════════════════════════════════════════════
// QA secondaire optionnelle.
// Ce bloc reste ici car il est directement branché au runtime d'exécution des agents.

// HELPERS UI PIPELINE
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/launch_runtime_ui.js.

function getPipelineLaunchMode(prefix) {
  if (typeof getPipelineModeByPrefix === 'function') {
    return getPipelineModeByPrefix(prefix);
  }
  return prefix === 'col' ? 'collection' : 'tabletop';
}

function getSafePipelineAgentsFallback() {
  if (typeof getPipelineAgents === 'function') {
    const agents = getPipelineAgents();
    return Array.isArray(agents) ? agents : [];
  }

  return [];
}

function getPipelineTargetStepsForPrefix(prefix) {
  const mode = getPipelineLaunchMode(prefix);

  if (typeof getPipelineTargetSteps === 'function') {
    return getPipelineTargetSteps(mode);
  }

  return getSafePipelineAgentsFallback().map((agent) => ({
    id: agent.id,
    label: agent.title,
  }));
}

function getPipelineTargetStepMetaForPrefix(prefix, stepId = '') {
  const mode = getPipelineLaunchMode(prefix);

  if (typeof getPipelineTargetStepMeta === 'function') {
    return getPipelineTargetStepMeta(mode, stepId);
  }

  return null;
}

function getPipelineRuntimeAgentIdsForPrefix(prefix, stepId = '') {
  const mode = getPipelineLaunchMode(prefix);
  const resolvedStepId = String(stepId || '').trim();

  if (typeof getPipelineRuntimeAgentIdsForTarget === 'function') {
    return getPipelineRuntimeAgentIdsForTarget(mode, resolvedStepId);
  }

  if (typeof getPipelineRuntimeAgentIds === 'function') {
    return getPipelineRuntimeAgentIds(mode);
  }

  return getSafePipelineAgentsFallback().map((agent) => agent.id);
}

function getPipelineRuntimeAgentsForTarget(prefix, stepId = '') {
  const runtimeAgentIds = getPipelineRuntimeAgentIdsForPrefix(prefix, stepId);
  const availableAgents = getSafePipelineAgentsFallback();
  const agentMap = new Map(availableAgents.map((agent) => [agent.id, agent]));

  return runtimeAgentIds.map((agentId) => agentMap.get(agentId)).filter(Boolean);
}

function getPipelineDisplayStepIdForRuntimeAgent(prefix, runtimeAgentId = '') {
  const targetSteps = getPipelineTargetStepsForPrefix(prefix);
  if (targetSteps.some((step) => step.id === runtimeAgentId)) return runtimeAgentId;

  const altTargetMeta = getPipelineTargetStepMetaForPrefix(prefix, 'alt');
  if (altTargetMeta?.stopAfterAgentId === runtimeAgentId) return altTargetMeta.id;

  return runtimeAgentId;
}

// Launch state, run-state bridge and cache-aware prelaunch moved to
// pipeline/runtime/launch_runtime_ui.js.

// Moved to pipeline/runtime/iris_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// Cœur d'exécution agent par agent.
// Zone à haut risque : couplage fort entre état, prompts, DOM et cartes UI.
// C'est l'une des dernières parties à découper, pas une cible de nettoyage opportuniste.

// RUN AGENT
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/agent_runtime_ui.js.


// ═══════════════════════════════════════════════════════════
// Contrôle global du pipeline unitaire.
// Ce bloc orchestre aussi les transitions de vues et les déplacements DOM vers la vue
// pipeline. Toute extraction future devra être testée visuellement sur TT et Collection.

// PIPELINE CONTROL
// ═══════════════════════════════════════════════════════════
// PIPELINE CONTROL
// ???????????????????????????????????????????????????????????????????????????
// Moved to pipeline/runtime/launch_runtime_ui.js and pipeline/runtime/social_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// OUTPUT FINAL
// ═══════════════════════════════════════════════════════════

// Moved to pipeline/runtime/output_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// TITRE EXPLORER
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Monitoring session.
// Affichage UI + cumul de coût runtime. Bloc isolable plus tard, mais déplacé seulement
// quand le coeur pipeline et le reporting auront des contrats plus stables.

// MONITORING COÛTS
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/cost_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// PERSISTANCE FORMULAIRE
// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
