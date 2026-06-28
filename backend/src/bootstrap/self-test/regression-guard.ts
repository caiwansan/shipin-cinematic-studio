/**
 * bootstrap/self-test/regression-guard.ts — Regression Protection Gate
 *
 * Phase 3, Rule 4: 检测 runtime regression，防止回退到旧的依赖 ALS 模式
 */

export interface RegressionState {
  /** 是否检测到 fallback runtime（没有显式 RuntimePayload） */
  hasFallbackRuntime: boolean
  /** 是否检测到遗留 provider 调用（走旧 handler 路径） */
  hasLegacyProviderCall: boolean
  /** runtime 是否已冻结 */
  registryFrozen: boolean
}

export function assertNoRegression(state: RegressionState): void {
  const issues: string[] = []

  if (state.hasFallbackRuntime) {
    issues.push('fallback runtime detected — 存在未传入 RuntimePayload 的调用')
  }

  if (state.hasLegacyProviderCall) {
    issues.push('legacy provider call detected — worker 未使用 modelAdapterRegistry.execute()')
  }

  if (!state.registryFrozen) {
    issues.push('registry 未冻结 — boot 可能未完成')
  }

  if (issues.length > 0) {
    throw new Error(`[regression] ❌ Runtime 回归检测失败:\n  - ${issues.join('\n  - ')}`)
  }

  console.log('[regression] ✅ 无回归: runtime 路径合规')
}
