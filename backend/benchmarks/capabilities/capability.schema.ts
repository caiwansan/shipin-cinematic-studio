import type { CapabilityDefinition } from './capability.types.js'

/**
 * 验证 CapabilityDefinition 的合法性。
 * 在注册时自动调用。
 */
export function validateCapability(
  cap: CapabilityDefinition,
  knownIds: Set<string>,
): string[] {
  const errors: string[] = []

  // ID 格式：全大写 + 下划线
  if (!/^[A-Z][A-Z0-9_]*$/.test(cap.id)) {
    errors.push(`Capability "${cap.id}": id must be UPPER_SNAKE_CASE`)
  }

  // 组必须在预定义范围内
  const validGroups = [
    'camera', 'lighting', 'character', 'render',
    'physics', 'temporal', 'action', 'emotion',
    'spatial', 'style', 'audio', 'dialogue', 'world', 'post',
  ]
  if (!validGroups.includes(cap.group)) {
    errors.push(`Capability "${cap.id}": unknown group "${cap.group}"`)
  }

  // Stage
  const validStages = ['compiler', 'planner', 'negotiator', 'renderer']
  if (!validStages.includes(cap.stage)) {
    errors.push(`Capability "${cap.id}": unknown stage "${cap.stage}"`)
  }

  // Difficulty
  const validDifficulties = ['L0', 'L1', 'L2', 'L3']
  if (!validDifficulties.includes(cap.difficulty)) {
    errors.push(`Capability "${cap.id}": unknown difficulty "${cap.difficulty}"`)
  }

  // 依赖必须存在（循环依赖暂不检查）
  for (const dep of cap.dependencies) {
    if (!knownIds.has(dep)) {
      errors.push(`Capability "${cap.id}": depends on unknown "${dep}"`)
    }
  }

  // Name/description must be non-empty
  if (!cap.name) errors.push(`Capability "${cap.id}": name is required`)
  if (!cap.description) errors.push(`Capability "${cap.id}": description is required`)

  return errors
}

/**
 * 验证整个 Registry 的完整性。
 */
export function validateRegistry(registry: { all: readonly CapabilityDefinition[] }): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const ids = new Set(registry.all.map(c => c.id))

  // 去重检查
  if (ids.size !== registry.all.length) {
    const seen = new Map<string, number>()
    for (const cap of registry.all) {
      seen.set(cap.id, (seen.get(cap.id) ?? 0) + 1)
    }
    for (const [id, count] of seen) {
      if (count > 1) errors.push(`Duplicate capability id: "${id}" (${count}x)`)
    }
  }

  // 逐条验证
  for (const cap of registry.all) {
    errors.push(...validateCapability(cap, ids))
  }

  // 每个 group 至少有一个能力
  const groupCounts = new Map<string, number>()
  for (const cap of registry.all) {
    groupCounts.set(cap.group, (groupCounts.get(cap.group) ?? 0) + 1)
  }

  // 每个 stage 至少有一个能力
  const stageCounts = new Map<string, number>()
  for (const cap of registry.all) {
    stageCounts.set(cap.stage, (stageCounts.get(cap.stage) ?? 0) + 1)
  }

  const allGroups = [
    'camera', 'lighting', 'character', 'render',
    'physics', 'temporal', 'action', 'emotion',
    'spatial', 'style', 'audio', 'dialogue', 'world', 'post',
  ]
  for (const group of allGroups) {
    if (!groupCounts.has(group)) {
      warnings.push(`Group "${group}" has zero capabilities`)
    }
  }

  const allStages = ['compiler', 'planner', 'negotiator', 'renderer']
  for (const stage of allStages) {
    const count = stageCounts.get(stage) ?? 0
    if (count === 0) warnings.push(`Stage "${stage}" has zero capabilities`)
  }

  return { valid: errors.length === 0, errors, warnings }
}
