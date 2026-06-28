/**
 * BenchmarkValidator — 统一验证入口
 *
 * 调用所有 Validator，合并输出 ValidationReport。
 * CLI / CI / Pipeline Report 都通过此入口验证。
 */

import type { ValidationItem, ValidationReport, Validator } from './ValidationReport.js'
import { createValidationReport } from './ValidationReport.js'
import { validateAllDatasets } from './DatasetValidator.js'
import { validateRegistryCoverage } from './RegistryValidator.js'
import { validateRegistryIntegrity } from './RegistryIntegrityValidator.js'
import { CapabilityRegistry } from '../capabilities/registry.js'

/**
 * 执行全部验证
 */
export function validateAll(strict = false): ValidationReport {
  const items: ValidationItem[] = []

  // 1. Registry Integrity
  items.push(...validateRegistryIntegrity())

  // 2. Dataset Capability Validation
  items.push(...validateAllDatasets())

  // 3. Registry Coverage
  items.push(...validateRegistryCoverage())

  const datasetCount = countDatasets()
  const registryCount = CapabilityRegistry.all.length

  return createValidationReport(
    'BenchmarkValidator',
    items,
    strict,
    datasetCount,
    registryCount,
  )
}

/**
 * 仅验证 Dataset（供 CLI 单独使用）
 */
export function validateDatasets(strict = false): ValidationReport {
  const items = validateAllDatasets()
  return createValidationReport(
    'DatasetValidator',
    items,
    strict,
    countDatasets(),
    CapabilityRegistry.all.length,
  )
}

/**
 * 仅验证 Registry（供 CLI 单独使用）
 */
export function validateRegistry(strict = false): ValidationReport {
  const items = [...validateRegistryIntegrity(), ...validateRegistryCoverage()]
  return createValidationReport(
    'RegistryValidator',
    items,
    strict,
    countDatasets(),
    CapabilityRegistry.all.length,
  )
}

// ─── Helper ──────────────────────────────────────────

import * as fs from 'fs'
import * as path from 'path'

function countDatasets(): number {
  const dir = path.resolve(process.cwd(), 'benchmarks', 'datasets')
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length
}

/**
 * 打印人类可读的验证摘要
 */
export function printValidationReport(report: ValidationReport): string {
  const lines: string[] = []

  if (report.errorCount > 0) {
    for (const item of report.items.filter(i => i.severity === 'error')) {
      lines.push(`❌ ${item.type}: ${item.message}`)
    }
  }

  if (report.warningCount > 0) {
    for (const item of report.items.filter(i => i.severity === 'warning')) {
      lines.push(`⚠️  ${item.type}: ${item.message}`)
    }
  }

  lines.push('')
  lines.push(`✔ Registry: ${report.registryCount} capabilities`)
  lines.push(`✔ Datasets: ${report.datasetCount} datasets`)
  lines.push(`${report.errorCount > 0 ? '❌' : '✔'} Errors: ${report.errorCount}`)
  lines.push(`${report.warningCount > 0 ? '⚠️' : '✔'} Warnings: ${report.warningCount}`)

  if (report.passed) {
    lines.push('')
    lines.push('✅ PASS')
  } else {
    lines.push('')
    lines.push('❌ FAIL (strict mode: errors > 0)')
  }

  return lines.join('\n')
}
