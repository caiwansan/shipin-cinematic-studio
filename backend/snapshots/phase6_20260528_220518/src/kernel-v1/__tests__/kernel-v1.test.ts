/**
 * kernel-v1/__tests__/kernel-v1.test.ts — Kernel v1 MVEL 验证测试
 *
 * 覆盖 MVEL 核心断言：
 * Test 1: Event Sourcing — create → update → delete → replay → state match
 * Test 2: Isolation — UI 写 EntityGraph 必须拒绝，Agent 写必须通过
 * Test 3: Determinism — rebuild 3 次结果必须完全一致
 * Test 4: Edge cases — 空项目 / 不存在实体读取 / 非法 target / 缺失 projectId
 * Test 5: 多实体 batch — batchCreate → replay → 计数正确
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { CanonicalKernel } from '../kernel.js'
import { KernelSource, KernelTarget, KernelType } from '../types.js'

let kernel: CanonicalKernel
const PROJECT_ID = 'test-project-001'

beforeAll(() => {
  kernel = new CanonicalKernel()
})

function cmd(
  source: KernelSource,
  type: KernelType,
  target: KernelTarget,
  overrides: Partial<{
    projectId: string
    entityType: string
    entityId: string
    data: any
    diff: any
    batch: any[]
    reason: string
  }> = {}
) {
  return {
    source,
    type,
    target,
    payload: {
      projectId: overrides.projectId ?? PROJECT_ID,
      entityType: overrides.entityType,
      entityId: overrides.entityId,
      data: overrides.data,
      diff: overrides.diff,
      reason: overrides.reason,
      batch: overrides.batch,
    },
  }
}

// =================================================================
// Test 1: Event Sourcing
// =================================================================
describe('Event Sourcing — create → update → delete → replay → state match', () => {
  it('should reconstruct exact state from EventLog', async () => {
    const pid = 'test-es-' + Date.now()

    // Step 1: Create character
    const createResult = await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId: pid,
        entityType: 'character',
        data: { name: 'Alice', age: 28, role: 'protagonist' },
        reason: 'initial creation',
      })
    )
    expect(createResult.ok).toBe(true)
    const characterNode: any = createResult.result
    const characterId = characterNode.id

    // Step 2: Create scene
    await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId: pid,
        entityType: 'scene',
        data: { location: 'forest', mood: 'dark' },
      })
    )

    // Step 3: Update character
    await kernel.command(
      cmd('Agent', 'ENTITY_UPDATE', 'EntityGraph', {
        projectId: pid,
        entityType: 'character',
        entityId: characterId,
        diff: { age: 29 },
        reason: 'birthday',
      })
    )

    // Step 4: Verify state
    const state1 = await kernel.read(pid)
    expect(Object.keys(state1.entityGraph.entities).length).toBe(2)

    // Step 5: Delete character — use kernel command with correct entityId
    const delResult = await kernel.command(
      cmd('Agent', 'ENTITY_DELETE', 'EntityGraph', {
        projectId: pid,
        entityType: 'character',
        entityId: characterId,
      })
    )
    expect(delResult.ok).toBe(true)

    // Step 6: rebuild from EventLog
    const rebuilt = await kernel.rebuildProjectState(pid)
    const rebuiltEntities = Object.values(rebuilt.entityGraph.entities)

    // Expect: only scene exists, character was deleted
    expect(rebuiltEntities.length).toBe(1)
    expect(rebuiltEntities[0].type).toBe('scene')
    expect((rebuiltEntities[0] as any).data.location).toBe('forest')

    // Step 7: EventLog has 4 records
    const events = await kernel.stores.eventLog.replay(pid)
    expect(events.length).toBe(4)
    expect(events[0].type).toBe('ENTITY_CREATE')
    expect(events[1].type).toBe('ENTITY_CREATE')
    expect(events[2].type).toBe('ENTITY_UPDATE')
    expect(events[3].type).toBe('ENTITY_DELETE')

    // Step 8: sequence ascending
    expect(events[0].sequence).toBe(1)
    expect(events[1].sequence).toBe(2)
    expect(events[2].sequence).toBe(3)
    expect(events[3].sequence).toBe(4)

    // Quick cleanup
    kernel.stores.eventLog.clear(pid)
  })
})

// =================================================================
// Test 2: Isolation — Kernel 权限拦截
// =================================================================
describe('Isolation — 权限矩阵强制执行', () => {
  it('should reject UI writing EntityGraph', async () => {
    const promise = kernel.command(
      cmd('UI', 'ENTITY_CREATE', 'EntityGraph', {
        entityType: 'character',
        data: { name: 'Mallory' },
      })
    )
    await expect(promise).rejects.toThrow('Kernel')
  })

  it('should reject UI writing Timeline', async () => {
    const promise = kernel.command(
      cmd('UI', 'TIMELINE_UPDATE', 'Timeline', {
        data: { order: [1, 2, 3] },
      })
    )
    await expect(promise).rejects.toThrow('Kernel')
  })

  it('should allow Agent writing EntityGraph', async () => {
    const result = await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId: 'test-isolation-001',
        entityType: 'character',
        data: { name: 'Bob' },
      })
    )
    expect(result.ok).toBe(true)
  })

  it('should reject Agent writing Timeline', async () => {
    const promise = kernel.command(
      cmd('Agent', 'TIMELINE_UPDATE', 'Timeline', {
        projectId: 'test-isolation-001',
        data: { order: [1, 2, 3] },
      })
    )
    await expect(promise).rejects.toThrow('Kernel')
  })

  it('should reject UI writing EventLog directly', async () => {
    const promise = kernel.command(
      cmd('UI', 'ENTITY_CREATE', 'EventLog', {
        projectId: 'test-isolation-001',
        data: {},
      })
    )
    await expect(promise).rejects.toThrow('Kernel')
  })

  it('should allow TimelineStage writing Timeline', async () => {
    const result = await kernel.command(
      cmd('TimelineStage', 'TIMELINE_UPDATE', 'Timeline', {
        projectId: 'test-isolation-002',
        data: { episodes: [] },
      })
    )
    expect(result.ok).toBe(true)
  })

  it('should reject Execution writing EntityGraph', async () => {
    const promise = kernel.command(
      cmd('Execution', 'ENTITY_CREATE', 'EntityGraph', {
        projectId: 'test-isolation-001',
        entityType: 'character',
        data: { name: 'Unauthorized' },
      })
    )
    await expect(promise).rejects.toThrow('Kernel')
  })
})

// =================================================================
// Test 3: Determinism — rebuild 3 次结果必须一致
// =================================================================
describe('Determinism — rebuild 3 次结果完全一致', () => {
  it('should produce identical structure across 3 rebuilds', async () => {
    const projectId = 'test-determinism-001'

    // 写入一组确定性的 EntityGraph 命令
    const c1 = await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId,
        entityType: 'character',
        data: { name: 'X', age: 25 },
      })
    )
    const charId = (c1.result as any).id

    await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId,
        entityType: 'scene',
        data: { location: 'city' },
      })
    )

    await kernel.command(
      cmd('Agent', 'ENTITY_UPDATE', 'EntityGraph', {
        projectId,
        entityType: 'character',
        entityId: charId,
        diff: { age: 30 },
      })
    )

    // 重建 3 次
    const rebuilt1 = await kernel.rebuildProjectState(projectId)
    const rebuilt2 = await kernel.rebuildProjectState(projectId)
    const rebuilt3 = await kernel.rebuildProjectState(projectId)

    // 验证结构一致性（类型 + 数量 + version）
    function extractStructure(state: any) {
      const entities = Object.values(state.entityGraph.entities) as any[]
      return {
        count: entities.length,
        types: entities.map((e: any) => e.type).sort(),
        version: state.entityGraph.version,
      }
    }

    const s1 = extractStructure(rebuilt1)
    const s2 = extractStructure(rebuilt2)
    const s3 = extractStructure(rebuilt3)

    expect(s1).toEqual(s2)
    expect(s2).toEqual(s3)

    // Verify expected content
    expect(s1.count).toBe(2)
    expect(s1.types).toEqual(['character', 'scene'])

    const data = Object.values(rebuilt1.entityGraph.entities) as any[]
    const char = data.find((e: any) => e.type === 'character')
    expect(char.data.age).toBe(30)
  })
})

// =================================================================
// Test 4: Edge Cases
// =================================================================
describe('Edge cases', () => {
  it('should reject command with missing projectId', async () => {
    const promise = kernel.command({
      source: 'Agent',
      type: 'ENTITY_CREATE',
      target: 'EntityGraph',
      payload: {
        projectId: '',  // empty
        entityType: 'character',
        data: {},
      },
    })
    await expect(promise).rejects.toThrow('missing payload.projectId')
  })

  it('should read empty project as empty state', async () => {
    const state = await kernel.read('nonexistent-project')
    expect(state.projectId).toBe('nonexistent-project')
    expect(Object.keys(state.entityGraph.entities).length).toBe(0)
    expect(state.entityGraph.version).toBe(0)
  })

  it('should rebuild empty project as empty state', async () => {
    const rebuilt = await kernel.rebuildProjectState('empty-project')
    expect(Object.keys(rebuilt.entityGraph.entities).length).toBe(0)
  })

  it('should throw on unknown source', async () => {
    const promise = kernel.command({
      source: 'UnknownSource' as any,
      type: 'ENTITY_CREATE',
      target: 'EntityGraph',
      payload: {
        projectId: 'test-edge-001',
        data: {},
      },
    })
    await expect(promise).rejects.toThrow('Kernel')
  })

  it('should handle entity update on nonexistent entity gracefully', async () => {
    const promise = kernel.command(
      cmd('Agent', 'ENTITY_UPDATE', 'EntityGraph', {
        projectId: 'test-edge-002',
        entityType: 'character',
        entityId: 'nonexistent-entity',
        diff: { name: 'Ghost' },
      })
    )
    await expect(promise).rejects.toThrow('entity not found')
  })
})

// =================================================================
// Test 5: Batch Create + Replay
// =================================================================
describe('Batch create + replay', () => {
  it('should batch create and replay correctly', async () => {
    const projectId = 'test-batch-001'

    await kernel.command(
      cmd('Agent', 'ENTITY_BATCH_CREATE', 'EntityGraph', {
        projectId,
        batch: [
          { entityType: 'character', data: { name: 'Team A' } },
          { entityType: 'character', data: { name: 'Team B' } },
          { entityType: 'scene', data: { location: 'mountain' } },
        ],
      })
    )

    const state = await kernel.read(projectId)
    const entities = Object.values(state.entityGraph.entities)
    expect(entities.length).toBe(3)

    const characters = entities.filter((e: any) => e.type === 'character')
    const scenes = entities.filter((e: any) => e.type === 'scene')
    expect(characters.length).toBe(2)
    expect(scenes.length).toBe(1)

    // Replay 验证
    const rebuilt = await kernel.rebuildProjectState(projectId)
    const rebuiltEntities = Object.values(rebuilt.entityGraph.entities)
    expect(rebuiltEntities.length).toBe(3)
  })
})

// =================================================================
// Test 6: EntityGraph version 递增
// =================================================================
describe('EntityGraph version tracking', () => {
  it('should increment version on each mutation', async () => {
    const projectId = 'test-version-001'

    const v0 = await kernel.read(projectId)
    expect(v0.entityGraph.version).toBe(0)

    await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId,
        entityType: 'prop',
        data: { name: 'sword' },
      })
    )

    const v1 = await kernel.read(projectId)
    expect(v1.entityGraph.version).toBeGreaterThan(v0.entityGraph.version)

    await kernel.command(
      cmd('Agent', 'ENTITY_CREATE', 'EntityGraph', {
        projectId,
        entityType: 'prop',
        data: { name: 'shield' },
      })
    )

    const v2 = await kernel.read(projectId)
    expect(v2.entityGraph.version).toBeGreaterThan(v1.entityGraph.version)
  })
})
