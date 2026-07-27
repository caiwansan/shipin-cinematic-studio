/**
 * ProductionMockDetector — 输出真实性守卫
 * 
 * 在任何 RenderAdapter 输出返回给用户之前，
 * 校验 URL/asset 不包含 mock/placeholder/example.com 关键字。
 * 
 * 这是 Reality Contract（真实性契约）的技术执行层。
 */

const MOCK_PATTERNS = [
  'mock.video',
  'mock://',
  'placeholder',
  'example.com',
  'fake.',
  'localhost',
  '127.0.0.1',
]

export class ProductionMockDetectedError extends Error {
  constructor(public readonly url: string) {
    super(`ProductionMockDetectedError: 生产输出包含假资产 URL → ${url}`)
    this.name = 'ProductionMockDetectedError'
  }
}

/**
 * 校验单个 URL。生产环境若包含 mock 模式则抛出异常。
 */
export function assertProductionSafeUrl(url: string): void {
  if (!url) return
  const lower = url.toLowerCase()
  for (const pattern of MOCK_PATTERNS) {
    if (lower.includes(pattern)) {
      throw new ProductionMockDetectedError(url)
    }
  }
}

/**
 * 校验 RenderResult 的所有输出 URL。
 */
export function assertProductionSafeResult(result: { videoUrl?: string; meta?: any }): void {
  if (result.videoUrl) {
    assertProductionSafeUrl(result.videoUrl)
  }
  // 深度扫描 meta 中的 URL（如 thumbnail、preview 等）
  if (result.meta && typeof result.meta === 'object') {
    scanObjectUrls(result.meta)
  }
}

function scanObjectUrls(obj: any, depth = 0): void {
  if (depth > 3 || !obj || typeof obj !== 'object') return
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && (key.includes('url') || key.includes('Url') || key.includes('src'))) {
      assertProductionSafeUrl(value)
    } else if (typeof value === 'object' && value !== null) {
      scanObjectUrls(value, depth + 1)
    }
  }
}
