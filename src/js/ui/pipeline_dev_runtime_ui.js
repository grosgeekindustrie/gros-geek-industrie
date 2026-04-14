'use strict';

// Runtime de développement léger.
// Lit src/js/ui/data/pipeline_dev_data.js et applique les options sans modifier
// config_ui.js ni le moteur principal. Ce fichier doit rester petit et retirable.

(function initPipelineUIDevRuntime(global) {
  const getDevConfig = () => global.PipelineUIDataDev?.PIPELINE_DEV_CONFIG || global.PIPELINE_DEV_CONFIG || {};
  const getModeKey = (mode = global.currentMode) => (
    typeof global.getPipelineModeKey === 'function'
      ? global.getPipelineModeKey(mode)
      : (mode === 'collection' ? 'collection' : 'tabletop')
  );
  const getConfiguredStopAfter = (mode = global.currentMode) => {
    const config = getDevConfig();
    const modeKey = getModeKey(mode);
    return String(config.stopAfterByMode?.[modeKey] || '').trim();
  };
  const hasTargetStep = (mode, stepId) => {
    if (!stepId || typeof global.getPipelineTargetSteps !== 'function') return false;

    return global.getPipelineTargetSteps(mode).some((step) => step.id === stepId);
  };

  const originalGetPipelineFinalTargetStepId = global.getPipelineFinalTargetStepId;
  const originalNormalizePipelineTargetStepId = global.normalizePipelineTargetStepId;
  const originalRunPipelineWithCacheAware = global.runPipelineWithCacheAware;

  const getPipelineFinalTargetStepIdDev = (mode = global.currentMode) => {
    const configuredStopAfter = getConfiguredStopAfter(mode);

    if (hasTargetStep(mode, configuredStopAfter)) {
      return configuredStopAfter;
    }

    return typeof originalGetPipelineFinalTargetStepId === 'function'
      ? originalGetPipelineFinalTargetStepId(mode)
      : '';
  };

  const normalizePipelineTargetStepIdDev = (mode = global.currentMode, stepId = '') => {
    const configuredStopAfter = getConfiguredStopAfter(mode);

    if (hasTargetStep(mode, configuredStopAfter)) {
      return configuredStopAfter;
    }

    return typeof originalNormalizePipelineTargetStepId === 'function'
      ? originalNormalizePipelineTargetStepId(mode, stepId)
      : getPipelineFinalTargetStepIdDev(mode);
  };

  const runPipelineWithCacheAwareDev = (prefix) => {
    const config = getDevConfig();

    if (config.cacheAwarePrelaunch === false && typeof global.startPipeline === 'function') {
      return global.startPipeline(prefix, {
        skipCacheRunInit: false,
        preserveRunState: false,
        preserveCacheStatus: false,
      });
    }

    return typeof originalRunPipelineWithCacheAware === 'function'
      ? originalRunPipelineWithCacheAware(prefix)
      : global.startPipeline?.(prefix);
  };

  Object.assign(global, {
    getPipelineFinalTargetStepId: getPipelineFinalTargetStepIdDev,
    normalizePipelineTargetStepId: normalizePipelineTargetStepIdDev,
    runPipelineWithCacheAware: runPipelineWithCacheAwareDev,
  });
})(window);
