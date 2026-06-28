/**
 * kernel/init-kernel.ts — Kernel 系统初始化
 *
 * Phase 6, 在 boot 阶段初始化 event sourcing 等
 */

export async function initKernel(): Promise<void> {
  console.log('[kernel] Init...')

  // 清空 event store（重启即重置）
  const { clearEventStore } = await import('./event-sourcing/execution-event-store.js')
  clearEventStore()

  console.log('[kernel] ✅ Init complete (event store cleared)')
}
