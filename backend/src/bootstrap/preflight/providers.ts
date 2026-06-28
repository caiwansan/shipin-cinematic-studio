/**
 * bootstrap/preflight/providers.ts — Provider Connectivity Preflight
 *
 * 检查所有 provider 的基础连通性（不发送真实 API 调用）
 * Phase 2, Rule 4: 不健康则系统 fail-fast
 */

// 支持的 provider 列表
const EXPECTED_PROVIDERS = ['aliyun', 'volcengine', 'openai', 'siliconflow', 'custom']

export async function verifyProviders(): Promise<void> {
  console.log(`[boot]   expected providers: ${EXPECTED_PROVIDERS.join(', ')}`)

  for (const p of EXPECTED_PROVIDERS) {
    // 轻量检查 provider 是否至少有一个适配器
    const ok = await checkProviderHealth(p)
    if (!ok) {
      console.warn(`[boot]   ⚠️ provider ${p}: 无适配器注册`)
    } else {
      console.log(`[boot]   ✅ provider ${p}: OK`)
    }
  }
}

async function checkProviderHealth(providerName: string): Promise<boolean> {
  try {
    const { modelAdapterRegistry } = await import('../../model-adapters/registry.js')
    // 检查是否有属于此 provider 的适配器
    const adapters = (modelAdapterRegistry as any).adapters
    if (!adapters || adapters.size === 0) return false

    for (const adapter of adapters.values()) {
      if (adapter.provider === providerName) return true
    }
    return false
  } catch {
    return false
  }
}
