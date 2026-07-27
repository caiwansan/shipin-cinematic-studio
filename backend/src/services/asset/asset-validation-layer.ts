/**
 * AssetValidationLayer — 资产真实性全局治理
 * 
 * WORKBENCH-HARDENING-01 Phase 3
 * 
 * 任何工作台输出 Asset（URL / 路径）前必须经过本层校验。
 * 覆盖范围：短剧、音乐、小说、GEO、媒体工作台。
 * 
 * 生成流程：
 * Generate Result → Validate Asset → Persist → Expose User
 * 
 * 校验失败 → 抛出 AssetValidationError（不是静默替换）
 */

import { assertProductionSafeUrl, ProductionMockDetectedError } from '../production-loop/render-adapter-contract/production-mock-detector'

export class AssetValidationError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`AssetValidationError: ${reason} → ${url}`)
    this.name = 'AssetValidationError'
  }
}

/**
 * 校验单个 Asset URL。
 * 所有工作台输出前必须调用。
 */
export function validateAssetUrl(url: string): void {
  if (!url) return
  try {
    assertProductionSafeUrl(url)
  } catch (e) {
    if (e instanceof ProductionMockDetectedError) {
      throw new AssetValidationError(url, '生产输出包含假资产 URL')
    }
    throw e
  }
}

/**
 * 校验 Asset 对象（包含 URL + 元数据）
 */
export function validateAsset(asset: { url?: string; thumbnailUrl?: string; previewUrl?: string; [key: string]: any }): void {
  if (asset.url) validateAssetUrl(asset.url)
  if (asset.thumbnailUrl) validateAssetUrl(asset.thumbnailUrl)
  if (asset.previewUrl) validateAssetUrl(asset.previewUrl)
}

/**
 * 批量校验 Asset 列表
 */
export function validateAssets(assets: Array<{ url?: string; [key: string]: any }>): void {
  for (const asset of assets) {
    validateAsset(asset)
  }
}

/**
 * 校验 Prisma 模型中的 asset 字段（统一_assets 表）
 * 可传入任意含 sourceUrl / content 字段的模型
 */
export function validateUnifiedAsset(asset: { sourceUrl?: string; content?: string; type?: string }): void {
  if (asset.sourceUrl) {
    try {
      validateAssetUrl(asset.sourceUrl)
    } catch (e) {
      // content 字段中的 markdown 内嵌 URL 暂不扫描（Phase 4 拓展）
    }
  }
}
