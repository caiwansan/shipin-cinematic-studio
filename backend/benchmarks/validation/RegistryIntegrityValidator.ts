/**
 * Registry Integrity Validator
 *
 * 验证 Registry 自身的完整性：
 *   ① 所有能力 ID 唯一
 *   ② 依赖链中没有死循环
 *   ③ 所有依赖的 ID 存在
 *   ④ 每个 stage 至少有一个能力
 *   ⑤ 每个 group 至少有一个能力（可选）
 */

import type { ValidationItem } from './ValidationReport.js'
import { CapabilityRegistry } from '../capabilities/registry.js'
import { validateRegistry } from '../capabilities/capability.schema.js'

export function validateRegistryIntegrity(): ValidationItem[] {
  const items: ValidationItem[] = []

  // 复用 capability.schema.ts 的 validateRegistry
  const result = validateRegistry(CapabilityRegistry)

  for (const err of result.errors) {
    items.push({
      type: 'RegistryError',
      severity: 'error',
      message: err,
    })
  }

  for (const warn of result.warnings) {
    items.push({
      type: 'RegistryWarning',
      severity: 'warning',
      message: warn,
    })
  }

  return items
}
