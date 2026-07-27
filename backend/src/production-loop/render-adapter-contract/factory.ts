/**
 * RenderAdapterFactory — 根据环境返回正确的 RenderAdapter
 * 
 * 规则：
 * - test/dev → MockRenderAdapter（保留开发体验）
 * - production + 真实 GPU Provider 已配置 → ProductionRenderAdapter（Phase 4 接入）
 * - production + 真实 GPU Provider 未配置 → StubRenderAdapter（FAIL FAST）
 * 
 * 禁止降级到 Mock。禁止生产环境 new LocalMockRenderer()。
 */

import type { RenderAdapter } from './render-adapter'
import { MockRenderAdapter } from './mock-render-adapter'
import { StubRenderAdapter } from './stub-render-adapter'

let cachedAdapter: RenderAdapter | null = null

/**
 * 获取 RenderAdapter 实例（单例）。
 * 
 * 首次调用时根据环境初始化，后续复用。
 */
export function getRenderAdapter(): RenderAdapter {
  if (cachedAdapter) return cachedAdapter

  const env = process.env.NODE_ENV || 'development'

  if (env === 'test' || env === 'development') {
    cachedAdapter = new MockRenderAdapter()
    console.log('[RenderAdapterFactory] ✅ MockRenderAdapter active (test/dev)')
  } else if (isProductionRendererReady()) {
    // Phase 4: ProductionRenderAdapter
    cachedAdapter = new StubRenderAdapter()
    console.log('[RenderAdapterFactory] ⚠️ Production renderer not connected → StubRenderAdapter (FAIL FAST)')
  } else {
    cachedAdapter = new StubRenderAdapter()
    console.log('[RenderAdapterFactory] ⚠️ Production renderer unavailable → StubRenderAdapter (FAIL FAST)')
  }

  return cachedAdapter
}

/**
 * 检查生产渲染链路是否就绪。
 * Phase 4 将在此接入真实的 GPU/COS/FFmpeg 检测。
 */
function isProductionRendererReady(): boolean {
  // 检测关键 Provider 环境变量是否配置
  const hasGpuProvider = !!(
    process.env.GPU_PROVIDER_API_KEY ||
    process.env.RENDER_ENDPOINT
  )
  return hasGpuProvider
}

/**
 * 强制重置 adapter（主要用于测试）。
 */
export function __resetRenderAdapter_FOR_TEST_ONLY(): void {
  cachedAdapter = null
}
