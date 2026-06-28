/**
 * A3.5 Kernel Freeze Compatibility Test
 * =====================================
 * 不测试业务逻辑，只测试 Kernel API 的契约稳定性。
 *
 * 测试目标：
 * 1. 所有 Kernel API 模块编译通过
 * 2. 模块之间可互相消费（filmIR → diagnostics → diff → migration）
 * 3. freeze / clone / diff / diagnostics / migration 签名稳定
 * 4. 向后兼容：新增可选字段不破坏已有测试
 */

import { describe, test, expect } from 'vitest'
import { emptyFilmIR, freezeFilmIR, cloneFilmIR, generateFilmIRId, createFilmIRMetadata } from '../../../runtime/film-language-ir.js'
import { emptyDiagnostics, aggregateDiagnostics, type FilmIRProblem } from '../../../runtime/film-ir-diagnostics.js'
import { diffFilmIR, formatDiff } from '../../../runtime/film-ir-diff.js'
import { migrateIR, registerDefaultMigrations } from '../../../runtime/film-ir-version.js'
import { createExecutionContext } from '../../../runtime/execution-context.js'

describe('A3.5 Kernel Freeze — 模块编译', () => {
  test('emptyFilmIR 产生合法结构', () => {
    const ir = emptyFilmIR(8)
    expect(ir.metadata).toBeDefined()
    expect(ir.metadata.id).toMatch(/^filmir_/)
    expect(ir.metadata.schemaVersion).toBe('film-ir@0.1')
    expect(ir.global.duration).toBe(8)
    expect(ir.scene).toBeDefined()
    expect(ir.characters).toEqual([])
    expect(ir.camera).toBeDefined()
    expect(ir.lighting).toBeDefined()
    expect(ir.action).toEqual([])
    expect(ir.environment).toBeDefined()
    expect(ir.style).toBeDefined()
    expect(ir.constraints).toBeDefined()
    expect(ir.constraints.physics).toEqual([])
    expect(ir.constraints.continuity).toEqual([])
  })

  test('createExecutionContext 产生合法结构', () => {
    const ctx = createExecutionContext({ projectId: 'proj_1', userId: 'user_1' })
    expect(ctx.requestId).toMatch(/^req_/)
    expect(ctx.traceId).toMatch(/^trace_/)
    expect(ctx.projectId).toBe('proj_1')
    expect(ctx.userId).toBe('user_1')
    expect(ctx.startTime).toBeGreaterThan(0)
  })
})

describe('A3.5 Kernel Freeze — freeze / clone', () => {
  test('freezeFilmIR 后对象不可修改', () => {
    const ir = emptyFilmIR(5)
    const frozen = freezeFilmIR(ir)
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.global)).toBe(true)
    expect(Object.isFrozen(frozen.scene)).toBe(true)
    expect(Object.isFrozen(frozen.camera)).toBe(true)
    expect(Object.isFrozen(frozen.lighting)).toBe(true)
    expect(Object.isFrozen(frozen.environment)).toBe(true)
    expect(Object.isFrozen(frozen.style)).toBe(true)
    expect(Object.isFrozen(frozen.constraints)).toBe(true)
    // 冻结数组内的对象
    expect(Object.isFrozen(frozen.characters)).toBe(true)
    expect(Object.isFrozen(frozen.action)).toBe(true)
    // 更严格的数组元素冻结：数组本身 freeze 后元素不可修改
    // 注意：characters 空数组，push 会抛 TypeError
    expect(() => (frozen as any).characters.push({ name: 'test' })).toThrow()
  })

  test('cloneFilmIR 产生新 ID 和 parentId', () => {
    const ir = emptyFilmIR(5)
    const frozen = freezeFilmIR(ir)
    const cloned = cloneFilmIR(frozen)
    
    expect(cloned.metadata.id).not.toBe(ir.metadata.id)
    expect(cloned.metadata.parentId).toBe(ir.metadata.id)
    expect(cloned.metadata.version).toBe('0.1.1')
    expect(cloned.global.duration).toBe(5)
    
    // 克隆内容应一致
    expect(cloned.scene.location).toBe(ir.scene.location)
    expect(cloned.camera.shotType).toBe(ir.camera.shotType)
  })

  test('generateFilmIRId 格式稳定', () => {
    const id1 = generateFilmIRId()
    const id2 = generateFilmIRId()
    expect(id1).toMatch(/^filmir_/)
    expect(id1).not.toBe(id2)
  })
})

describe('A3.5 Kernel Freeze — Diagnostics', () => {
  test('emptyDiagnostics 返回满分', () => {
    const d = emptyDiagnostics()
    expect(d.score.overall).toBe(1)
    expect(d.summary.errors).toBe(0)
    expect(d.problems).toEqual([])
  })

  test('aggregateDiagnostics 评分算法稳定', () => {
    const problems: FilmIRProblem[] = [
      { id: 'p1', severity: 'error', category: 'camera', field: 'camera.shotType', message: 'shots type is empty', autoFixable: false },
      { id: 'p2', severity: 'warning', category: 'lighting', field: 'lighting.keyLight', message: 'keyLight is missing', autoFixable: true, autoFix: 'soft frontal' },
      { id: 'p3', severity: 'info', category: 'scene', field: 'scene.weather', message: 'weather not set', autoFixable: false },
      { id: 'p4', severity: 'error', category: 'physics', field: 'constraints.physics', message: 'no physics constraints', autoFixable: true, autoFix: 'add standard physics' },
    ]

    const d = aggregateDiagnostics(problems)
    expect(d.summary.errors).toBe(2)
    expect(d.summary.warnings).toBe(1)
    expect(d.summary.infos).toBe(1)
    expect(d.summary.autoFixes).toBe(2)
    expect(d.score.byCategory.camera).toBe(0.6)    // 1 - 0.4
    expect(d.score.byCategory.lighting).toBe(0.85)  // 1 - 0.15
    expect(d.score.byCategory.scene).toBe(1)         // info 不扣分
    expect(d.score.byCategory.physics).toBe(0.6)     // 1 - 0.4
    expect(d.score.overall).toBeCloseTo((0.6 + 0.85 + 1 + 0.6) / 4, 3)
  })
})

describe('A3.5 Kernel Freeze — Diff Engine', () => {
  test('diffFilmIR 检测 field 变更', () => {
    const from = emptyFilmIR(5)
    const frozen = freezeFilmIR(from)
    const to = cloneFilmIR(frozen)
    
    // 修改几个字段
    to.global.mood = 'tension'
    to.camera.shotType = 'close-up'
    to.camera.movement = 'dolly-in'

    const diff = diffFilmIR(frozen, freezeFilmIR(to))

    expect(diff.fromId).toBe(from.metadata.id)
    expect(diff.toId).toBe(to.metadata.id)
    expect(diff.summary.modified).toBeGreaterThanOrEqual(2)  // mood + shotType
    
    // 检查指定字段
    const moodChange = diff.fieldChanges.find(c => c.field === 'global.mood')
    expect(moodChange).toBeDefined()
    expect(moodChange?.from).toBe('')
    expect(moodChange?.to).toBe('tension')
  })

  test('diffFilmIR 检测 character 新增', () => {
    const ir = emptyFilmIR(5)
    const frozen = freezeFilmIR(ir)
    const to = cloneFilmIR(frozen)
    
    to.characters.push({
      name: '沈三笑',
      position: '左前方',
      motion: '站立',
      expression: '平静',
    })

    const diff = diffFilmIR(frozen, freezeFilmIR(to))
    expect(diff.summary.added).toBeGreaterThanOrEqual(1)
    const charChange = diff.arrayChanges.find(c => c.field === 'characters')
    expect(charChange).toBeDefined()
    expect(charChange?.type).toBe('added')
  })

  test('formatDiff 输出可读文本', () => {
    const from = emptyFilmIR(5)
    const frozen = freezeFilmIR(from)
    const to = cloneFilmIR(frozen)
    to.camera.shotType = 'wide'

    const diff = diffFilmIR(frozen, freezeFilmIR(to), { agent: 'CameraAgent', reason: '需要建立空间关系' })
    const text = formatDiff(diff)
    expect(text).toContain('FilmIR Diff')
    expect(text).toContain('CameraAgent')
    expect(text).toContain('需要建立空间关系')
    expect(text).toContain('camera.shotType')
  })
})

describe('A3.5 Kernel Freeze — Version Migration', () => {
  test('版本相同不需要迁移', () => {
    const ir = emptyFilmIR(5)
    const migrated = migrateIR(ir, '0.1.0')
    expect(migrated.metadata.id).toBe(ir.metadata.id)
    expect(migrated.metadata.version).toBe('0.1.0')
  })

  test('registerDefaultMigrations 可安全调用', () => {
    registerDefaultMigrations()
    // 不应抛异常（无实际迁移函数，但可安全调用）
    expect(true).toBe(true)
  })
})

describe('A3.5 Kernel Freeze — 模块互相消费', () => {
  test('filmIR → diagnostics → diff → migration 可串联', () => {
    // 1. 创建 IR
    const ir = emptyFilmIR(8, { createdBy: 'test' })
    
    // 2. 冻结
    const frozen = freezeFilmIR(ir)
    
    // 3. 生成 Diagnostics
    const diag = aggregateDiagnostics([
      { id: 'e1', severity: 'warning', category: 'camera', field: 'camera.shotType', message: '没有 shotType', autoFixable: true, autoFix: 'medium shot' },
    ])
    expect(diag.summary.warnings).toBe(1)
    
    // 4. Clone 并修改
    const v2 = cloneFilmIR(frozen)
    v2.camera.shotType = 'medium shot'
    v2.global.mood = 'peaceful'
    
    // 5. Diff
    const diff = diffFilmIR(frozen, freezeFilmIR(v2))
    expect(diff.summary.modified).toBeGreaterThanOrEqual(1)
    
    // 6. Migration（v2 是 0.1.1, migrateIR 到 0.1.1 应无变更）
    const migrated = migrateIR(v2, '0.1.1')
    expect(migrated.metadata.version).toBe('0.1.1')
    
    // 全部通过
    expect(true).toBe(true)
  })

  test('ExecutionContext 与 FilmIR 类型不冲突', () => {
    const ir = emptyFilmIR(5)
    const ctx = createExecutionContext({ projectId: 'proj_x', userId: 'user_y' })
    
    // 验证 filmIR 中没有 exec context 字段
    expect((ir as any).requestId).toBeUndefined()
    expect((ir as any).traceId).toBeUndefined()
    
    // 验证 ExecutionContext 中没有 filmIR 字段
    expect((ctx as any).global).toBeUndefined()
    expect((ctx as any).scene).toBeUndefined()
  })
})
