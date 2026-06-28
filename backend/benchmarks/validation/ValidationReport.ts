// ─── Severity ────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info'

// ─── Validation Item ─────────────────────────────────

export interface ValidationItem {
  type: string
  severity: ValidationSeverity
  dataset?: string
  capability?: string
  message: string
}

// ─── Validation Report ───────────────────────────────

export interface ValidationReport {
  /** 统计 */
  errorCount: number
  warningCount: number
  infoCount: number
  datasetCount: number
  registryCount: number

  items: ValidationItem[]

  /** 执行元信息 */
  validator: string
  durationMs: number
  strict: boolean
  timestamp: string

  /** 快速结论 */
  passed: boolean
}

// ─── Validator 统一接口 ────────────────────────────

export interface Validator {
  readonly name: string
  validate(): ValidationItem[]
}

// ─── 工厂函数 ───────────────────────────────────────

export function createValidationReport(
  validator: string,
  items: ValidationItem[],
  strict: boolean,
  datasetCount: number,
  registryCount: number,
): ValidationReport {
  const start = Date.now()
  const errorCount = items.filter(i => i.severity === 'error').length
  const warningCount = items.filter(i => i.severity === 'warning').length
  const infoCount = items.filter(i => i.severity === 'info').length

  return {
    errorCount,
    warningCount,
    infoCount,
    datasetCount,
    registryCount,
    items,
    validator,
    durationMs: Date.now() - start,
    strict,
    timestamp: new Date().toISOString(),
    passed: strict ? errorCount === 0 : true,
  }
}
