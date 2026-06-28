/**
 * ExecutionResults Guard
 *
 * Guards every write to Project.executionResults by routing through
 * AigcSchemaValidator before persistence.
 *
 * Architecture:
 *   Agent Output → schemaGuard() → Valid ✓ → persisted to executionResults
 *                                → Invalid ✗ → Quarantine + 422
 *
 * This is injected into:
 *   1. script-submit.ts — after aigcOrchestrator.generate()
 *   2. workbench-project.ts — on PUT (frontend save)
 */

import { schemaValidator, buildReport, quarantine, type ValidationResult, type ValidationReport } from './schema-validator.js'

export interface GuardResult {
  passed: boolean
  validation: ValidationResult
  report: ValidationReport
  error?: string
}

/**
 * Guard executionResults data before saving.
 * On failure: quarantines the payload for analysis, returns structured error.
 * On success: returns clean pass-through.
 */
export function schemaGuard(data: any, source: string = 'script-submit', projectId?: string): GuardResult {
  if (!data || typeof data !== 'object') {
    const result = schemaValidator.validate(data)
    const report = buildReport(result)
    quarantine(data, report, source, projectId)
    return {
      passed: false,
      validation: result,
      report,
      error: 'Payload is null or not an object',
    }
  }

  const result = schemaValidator.validate(data)
  const report = buildReport(result)

  if (!result.valid) {
    const errorSummary = result.errors
      .slice(0, 5)
      .map(e => `[${e.code}] ${e.path}: ${e.message}`)
      .join('; ')

    console.error(`[SchemaGuard] ❌ Validation failed (${result.errors.length} errors, ${result.warnings.length} warnings): ${errorSummary}`)

    // Quarantine the invalid payload for later analysis
    quarantine(data, report, source, projectId)

    return {
      passed: false,
      validation: result,
      report,
      error: `Schema validation failed: ${result.errors.length} error(s). First: ${errorSummary}`,
    }
  }

  if (result.warnings.length > 0) {
    console.warn(`[SchemaGuard] ⚠️ Validation passed with ${result.warnings.length} warnings`)
  } else {
    console.log(`[SchemaGuard] ✅ Validation passed (${result.stats.fieldsChecked} fields, ${result.stats.arraysChecked} arrays, ${result.stats.durationMs}ms)`)
  }

  return {
    passed: true,
    validation: result,
    report,
  }
}
