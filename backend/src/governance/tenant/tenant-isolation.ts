/**
 * governance/tenant/tenant-isolation.ts — 多租户隔离
 *
 * Phase 5, Rule 3: 租户不可绕过隔离
 * 任何 execution 必须绑定到合法 userId
 */

export function assertTenantIsolation(runtime: { userId?: string }): void {
  if (!runtime.userId) {
    throw new Error('[governance/tenant] 缺少 userId — 拒绝匿名执行')
  }

  if (runtime.userId === 'system') {
    throw new Error('[governance/tenant] system runtime 禁止')
  }

  // self-test 特殊处理（仅在 boot 期间）
  if (runtime.userId.startsWith('__self_test__') || runtime.userId.startsWith('__boot_test__')) {
    return // 测试 hook 放行
  }
}
