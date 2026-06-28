export { cognitionLoop } from './director-cognition-loop.engine.js'
export { DirectorCognitionLoop, type CognitionLoopOptions, type CognitionLoopResult } from './director-cognition-loop.engine.js'
export { intentStateManager, type DirectorIntentState, type CharacterIntentState, type SceneIntent, type IntentConstraints } from './director-intent-state.js'
export { analyzeIntentDrift, type DriftReport, type DriftDetail, type CorrectionPatch } from './intent-feedback-analyzer.js'
export { enforceIntentOnAgentOutput, validatePipelineOutput, validateSchedulerOutput, type EnforcementResult, type EnforcementViolation } from './intent-enforcement.js'

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

