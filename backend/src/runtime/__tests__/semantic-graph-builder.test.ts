/**
 * Semantic Graph Builder 测试
 *
 * 验证：
 *   ① FilmIR → Graph Runtime 正确构建
 *   ② 四视图投影正确
 *   ③ Graph Validator 正确检测问题
 *   ④ 纯函数、确定性
 */

import { describe, test, expect } from 'vitest'
import { emptyFilmIR } from '../../runtime/film-language-ir.js'
import { buildFromFilmIR, toSceneGraph, toEventGraph, toTimeline, toDependency } from '../../runtime/semantic-graph-builder.js'
import { validateGraph } from '../../runtime/graph-runtime.js'

// ─── 构建一个测试用的 FilmIR ────────────────────────────

function makeTestFilmIR() {
  const ir = emptyFilmIR(15)
  ir.scene.location = '老茶馆门口'
  ir.scene.timeOfDay = '傍晚'
  ir.camera.shotType = '中景'
  ir.camera.movement = '推'
  ir.camera.angle = '平视'
  ir.lighting.keyLight = '傍晚暖色柔光'
  ir.lighting.mood = '宁静'
  ir.characters = [
    { name: '沈三笑', position: '画面中央偏左', motion: '推门走进', expression: '含笑', clothing: '青色长衫' },
    { name: '赵无眠', position: '后方追来', motion: '快步追入', expression: '愤怒', clothing: '黑衣劲装' },
  ]
  ir.action = [
    { type: '推门', subject: '沈三笑', target: '木门', physicsDetail: '右手推开木门，门板绕合页旋转' },
    { type: '追逐', subject: '赵无眠', target: '沈三笑', physicsDetail: '快步追入茶馆' },
  ]
  return ir
}

describe('Semantic Graph Builder', () => {
  test('构建的 Graph 包含所有节点类型', () => {
    const { graph, validation } = buildFromFilmIR(makeTestFilmIR())
    expect(graph.nodes.size).toBeGreaterThanOrEqual(5)  // scene + 2 chars + camera + lighting
    expect(graph.edges.length).toBeGreaterThanOrEqual(4)

    const types = new Set([...graph.nodes.values()].map(n => n.type))
    expect(types.has('location')).toBe(true)
    expect(types.has('character')).toBe(true)
    expect(types.has('camera')).toBe(true)
    expect(types.has('event')).toBe(true)
  })

  test('Graph Validator 通过健康图', () => {
    const { validation } = buildFromFilmIR(makeTestFilmIR())
    expect(validation.valid).toBe(true)
    expect(validation.issues.length).toBe(0)
  })

  test('确定性：相同 FilmIR 产生相同结构', () => {
    const a = buildFromFilmIR(makeTestFilmIR())
    const b = buildFromFilmIR(makeTestFilmIR())
    // metadata.id 不同，但 node 数量 / edge 数量 / label 一致
    expect(a.graph.metadata.nodeCount).toBe(b.graph.metadata.nodeCount)
    expect(a.graph.metadata.edgeCount).toBe(b.graph.metadata.edgeCount)
    expect(a.graph.nodes.size).toBe(b.graph.nodes.size)
    expect(a.graph.edges.length).toBe(b.graph.edges.length)
  })

  test('纯函数：不修改输入', () => {
    const ir = emptyFilmIR(5)
    const originalDuration = ir.global.duration
    const { graph } = buildFromFilmIR(ir)
    expect(ir.global.duration).toBe(originalDuration)
  })
})

describe('Scene View', () => {
  test('只返回空间相关的节点和边', () => {
    const { graph } = buildFromFilmIR(makeTestFilmIR())
    const scene = toSceneGraph(graph)
    expect(scene.locations.length).toBe(1)
    expect(scene.characters.length).toBe(2)
    expect(scene.spatialEdges.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Event View', () => {
  test('只返回事件节点和因果边', () => {
    const { graph } = buildFromFilmIR(makeTestFilmIR())
    const events = toEventGraph(graph)
    expect(events.events.length).toBe(2)  // 推门 + 追逐
    expect(events.causalEdges.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Timeline View', () => {
  test('事件按 follows 边排序', () => {
    const { graph } = buildFromFilmIR(makeTestFilmIR())
    const timeline = toTimeline(graph)
    expect(timeline.timeOrder.length).toBe(2)
    expect(timeline.events.length).toBe(2)
  })
})

describe('Dependency View', () => {
  test('rootSteps 不依赖任何节点', () => {
    const { graph } = buildFromFilmIR(makeTestFilmIR())
    const dep = toDependency(graph)
    expect(dep.rootSteps.length).toBeGreaterThan(0)
    expect(dep.parallelGroups.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Graph Validator', () => {
  test('检测孤立节点', () => {
    const { graph, validation } = buildFromFilmIR(makeTestFilmIR())
    expect(validation.valid).toBe(true)

    // 手动加一个孤立节点
    graph.nodes.set('node_isolated', { id: 'node_isolated', type: 'prop', label: '孤立道具', data: {} })
    // done via import
    const report = validateGraph(graph)
    expect(report.valid).toBe(false)
    expect(report.issues.some(i => i.type === 'orphan-node')).toBe(true)
  })

  test('检测不存在引用', () => {
    const { graph } = buildFromFilmIR(makeTestFilmIR())
    graph.edges.push({
      id: 'edge_bad_ref',
      source: 'node_nonexistent',
      target: graph.nodes.keys().next().value,
      type: 'holds',
      data: {},
    })
    // done via import
    const report = validateGraph(graph)
    expect(report.valid).toBe(false)
    expect(report.issues.some(i => i.type === 'reference-not-found')).toBe(true)
  })
})
