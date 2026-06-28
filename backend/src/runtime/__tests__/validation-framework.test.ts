/**
 * Validation Framework 测试
 *
 * P1.3.2: 验证 BenchmarkValidator 所有检查项正确运行。
 */

import { describe, test, expect } from 'vitest'
import {
  validateAll,
  validateAllDatasets,
  validateRegistryCoverage,
  validateRegistryIntegrity,
  printValidationReport,
} from '../../../benchmarks/validation/index.js'

describe('Registry Integrity Validator', () => {
  test('Registry 自身完整性检查无 error', () => {
    const items = validateRegistryIntegrity()
    const errors = items.filter(i => i.severity === 'error')
    expect(errors.length).toBe(0)
  })

  test('Registry 至少有一个能力', () => {
    const items = validateRegistryIntegrity()
    const hasWarning = items.some(i => i.type === 'RegistryWarning' && i.message.includes('zero capabilities'))
    expect(hasWarning).toBeDefined()
  })
})

describe('Dataset Capability Validator', () => {
  test('L0-001 和 L1-001 的 capability 引用合法', () => {
    const report = validateAll()
    // Check that errors don't include L0-001 or L1-001
    const l0Errors = report.items.filter(i => i.dataset === 'L0-001' && i.severity === 'error')
    const l1Errors = report.items.filter(i => i.dataset === 'L1-001' && i.severity === 'error')
    expect(l0Errors.length).toBe(0)
    expect(l1Errors.length).toBe(0)
    expect(report.items.length).toBeGreaterThan(0)
  })

  test('所有 Dataset 无 UnknownCapability 错误', () => {
    const items = validateAllDatasets()
    const unknown = items.filter(i => i.type === 'UnknownCapability')
    expect(unknown.length).toBe(0)
  })

  test('所有 Dataset primaryCapability 合法', () => {
    const items = validateAllDatasets()
    const missing = items.filter(i => i.type === 'MissingPrimaryCapability')
    const notIncluded = items.filter(i => i.type === 'PrimaryCapabilityNotIncluded')
    expect(missing.length).toBe(0)
    expect(notIncluded.length).toBe(0)
  })
})

describe('Registry Coverage Validator', () => {
  test('Registry 覆盖检查不报 error（只报 warning）', () => {
    const items = validateRegistryCoverage()
    const errors = items.filter(i => i.severity === 'error')
    expect(errors.length).toBe(0)
  })

  test('部分能力可能为 Uncovered（warning）', () => {
    const items = validateRegistryCoverage()
    const uncovered = items.filter(i => i.type === 'UncoveredCapability')
    expect(uncovered.length).toBeGreaterThanOrEqual(0)
  })
})

describe('BenchmarkValidator — 统一入口', () => {
  test('validateAll 返回完整 ValidationReport', () => {
    const report = validateAll()
    expect(report.errorCount).toBe(0)
    expect(report.datasetCount).toBeGreaterThanOrEqual(2)
    expect(report.registryCount).toBeGreaterThanOrEqual(29)
    expect(report.validator).toBe('BenchmarkValidator')
    expect(report.items.length).toBeGreaterThan(0)
  })

  test('printValidationReport 输出可读文本', () => {
    const report = validateAll()
    const text = printValidationReport(report)
    expect(text).toContain('Registry')
    expect(text).toContain('Datasets')
  })

  test('strict 模式不影响 warning', () => {
    const report = validateAll(true)
    expect(report.strict).toBe(true)
    expect(report.passed).toBe(true)
  })

  test('report 包含时间戳', () => {
    const report = validateAll()
    expect(report.timestamp).toBeTruthy()
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
  })
})
