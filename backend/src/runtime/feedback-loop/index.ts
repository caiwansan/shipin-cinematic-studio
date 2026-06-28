/**
 * runtime/feedback-loop/index.ts
 *
 * Feedback Loop Runtime — 自进化电影系统
 *
 * 导出核心模块，统一入口。
 */

export { evaluateVideo } from './video-critic.js'
export type { VideoCritique, CriticInput } from './video-critic.js'

export { analyzeGap } from './prompt-diff.js'
export type { PromptGap } from './prompt-diff.js'

export { autoFix } from './auto-fixer.js'
export type { AutoFixResult } from './auto-fixer.js'

export { runFeedbackLoop } from './loop-controller.js'
export type { LoopConfig, LoopResult, CinematicEvolutionMetrics } from './loop-controller.js'
