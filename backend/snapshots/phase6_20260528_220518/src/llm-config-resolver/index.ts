// llm-config-resolver/index.ts — 统一入口

export { resolveLLMConfig } from './resolver'
export { detectShadow } from './shadow-detector'
export { traceDecision } from './trace'
export { CONFIG_PRIORITY_DAG } from './types'
export type { ConfigLayer, ConfigCandidate, TraceEntry, ShadowAlert, ResolveResult, ResolveContext } from './types'
