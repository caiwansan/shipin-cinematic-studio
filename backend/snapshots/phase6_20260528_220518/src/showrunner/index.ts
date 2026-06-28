export { ShowrunnerCore, showrunnerCore } from './showrunner-core.js'
export type { ShowrunnerOutput } from './showrunner-core.js'

export { analyzeNarrative, type NarrativeUnderstanding, type CharacterNode, type NarrativeBeat } from './narrative-understanding.js'
export { buildEmotionalArchitecture, type EmotionalArchitecture, type EpisodeEmotion, type EmotionalTheme, type EngagementPhase } from './emotional-engine.js'
export { generateBlueprint, type SeriesBlueprint, type EpisodeBlueprint } from './structural-planner.js'
export { generateStrategy, type ProductionStrategy, type BudgetAllocation, type RenderPriority, type AssetReuse, type RiskManagement } from './production-strategist.js'
export { orchestrate, dispatchToScheduler, type ExecutionTaskGraph, type EpisodeTask, type SceneTask } from './execution-orchestrator.js'

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

