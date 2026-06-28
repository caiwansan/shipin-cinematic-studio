/**
 * provider-state/index.ts — Provider State Service v1.2 Final
 *
 * 纯观测层导出。不暴露任何决策/路由/CB 逻辑。
 */
export { ProviderState, ProviderStatus, createDefaultState, classifyProviderError } from './provider-state.js'
export { ProviderStateServiceFinal, initProviderStateService, getProviderStateService } from './provider-state.service.js'
