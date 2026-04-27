'use strict';

// Runtime de développement léger.
// Lit src/js/pipeline/dev/pipeline_dev_data.js et applique les options sans modifier
// config_ui.js ni le moteur principal. Ce fichier doit rester petit et retirable.

(function initPipelineUIDevRuntime(global) {
  const getDevConfig = () => global.PipelineUIDataDev.PIPELINE_DEV_CONFIG;
  const getModeKey = (mode = global.currentMode) => global.getPipelineModeKey(mode);
  const getConfiguredStopAfter = (mode = global.currentMode) => {
    const config = getDevConfig();
    const modeKey = getModeKey(mode);
    return String(config.stopAfterByMode?.[modeKey] || '').trim();
  };
  const hasTargetStep = (mode, stepId) => {
    if (!stepId) return false;

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

    return originalGetPipelineFinalTargetStepId(mode);
  };

  const normalizePipelineTargetStepIdDev = (mode = global.currentMode, stepId = '') => {
    const configuredStopAfter = getConfiguredStopAfter(mode);

    if (hasTargetStep(mode, configuredStopAfter)) {
      return configuredStopAfter;
    }

    return originalNormalizePipelineTargetStepId(mode, stepId);
  };

  const runPipelineWithCacheAwareDev = (prefix) => {
    const config = getDevConfig();

    if (config.cacheAwarePrelaunch === false) {
      return global.startPipeline(prefix, {
        skipCacheRunInit: false,
        preserveRunState: false,
        preserveCacheStatus: false,
      });
    }

    return originalRunPipelineWithCacheAware(prefix);
  };

  Object.assign(global, {
    getPipelineFinalTargetStepId: getPipelineFinalTargetStepIdDev,
    normalizePipelineTargetStepId: normalizePipelineTargetStepIdDev,
    runPipelineWithCacheAware: runPipelineWithCacheAwareDev,
  });
})(window);
