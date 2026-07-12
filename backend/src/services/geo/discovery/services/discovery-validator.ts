// ============================================================
// DiscoveryValidator — DiscoveryResult 进入下游前的统一校验
// 确保流向 Knowledge / Recommendations / Mission 的数据可信
// 验证失败时，直接 Fail，不向下游传递坏数据
// ============================================================

import type { DiscoveryResult } from '../../domain/discovery-result.js'

export interface ValidationReport {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export class DiscoveryValidator {
  /**
   * 校验 DiscoveryResult 的完整性
   * 如果 valid === false，不应向下游引擎传递
   */
  validate(result: DiscoveryResult): ValidationReport {
    const errors: ValidationError[] = []

    // Entity
    if (!result.entity.name) {
      errors.push({ field: 'entity.name', message: 'Entity name 不能为空', severity: 'error' })
    }

    // Confidence
    const conf = result.metadata.overralConfidence
    if (typeof conf !== 'number' || conf < 0 || conf > 100) {
      errors.push({ field: 'metadata.overralConfidence', message: 'Confidence 必须为 0~100 的数字', severity: 'error' })
    }

    // Presence
    if (typeof result.presence.visibility !== 'number') {
      errors.push({ field: 'presence.visibility', message: 'Visibility 必须为数字', severity: 'warning' })
    }

    // Evidence
    if (!Array.isArray(result.presence.citations)) {
      errors.push({ field: 'presence.citations', message: 'Citations 必须为数组', severity: 'error' })
    }

    // Knowledge
    if (!Array.isArray(result.knowledge.claims)) {
      errors.push({ field: 'knowledge.claims', message: 'Claims 必须为数组', severity: 'error' })
    }
    if (!Array.isArray(result.knowledge.evidence)) {
      errors.push({ field: 'knowledge.evidence', message: 'Knowledge evidence 必须为数组', severity: 'error' })
    }

    // Competitors
    if (!Array.isArray(result.competitors.entities)) {
      errors.push({ field: 'competitors.entities', message: 'Competitor entities 必须为数组', severity: 'warning' })
    }

    // Diagnostics — errors 必须存在
    if (!Array.isArray(result.diagnostics.errors)) {
      errors.push({ field: 'diagnostics.errors', message: 'Diagnostics errors 必须为数组', severity: 'error' })
    }

    // Providers
    if (!Array.isArray(result.metadata.providers) || result.metadata.providers.length === 0) {
      errors.push({ field: 'metadata.providers', message: '至少需要一个 Provider', severity: 'warning' })
    }

    const isError = errors.filter((e) => e.severity === 'error')
    return {
      valid: isError.length === 0,
      errors,
      warnings: errors.filter((e) => e.severity === 'warning').map((e) => `[${e.field}] ${e.message}`),
    }
  }
}

export const discoveryValidator = new DiscoveryValidator()
