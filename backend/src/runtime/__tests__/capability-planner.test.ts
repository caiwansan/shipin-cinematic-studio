/**
 * Capability Planner 测试
 *
 * 验证：
 *   ① 从 Graph Runtime 正确推导能力
 *   ② Provider 不可见（代码中不出现任何 Provider 名称）
 *   ③ 能力级别使用 level 体系
 *   ④ 纯函数、确定性
 */

import { describe, test, expect } from 'vitest'
import { planFromGraph, FILM_CAPABILITIES } from '../../runtime/capability-planner.js'
import { buildFromFilmIR } from '../../runtime/semantic-graph-builder.js'
import { emptyFilmIR } from '../../runtime/film-language-ir.js'

// ─── 构建一个测试用的 FilmIR → Graph ────────────────────

function makeTestGraph() {
  const ir = emptyFilmIR(10)
  ir.scene.location = '桃花树下'
  ir.camera.shotType = '中景'
  ir.camera.movement = '推'
  ir.camera.angle = '平视'
  ir.lighting.keyLight = '暖色柔光'
  ir.lighting.mood = '浪漫'
  ir.characters = [
    { name: '柳依依', position: '画面中央偏右', motion: '回眸轻笑', expression: '娇羞' },
    { name: '顾长风', position: '画面左侧', motion: '伸手欲挽', expression: '深情' },
  ]
  ir.action = [
    { type: '回眸', subject: '柳依依', target: '', physicsDetail: '回眸一笑' },
    { type: '伸手', subject: '顾长风', target: '柳依依的手', physicsDetail: '伸手轻触指尖' },
  ]
  return buildFromFilmIR(ir).graph
}

describe('Capability Planner', () => {
  test('产出 CapabilityPlan 包含 shots', () => {
    const graph = makeTestGraph()
    const plan = planFromGraph(graph)
    expect(plan.shots.length).toBeGreaterThan(0)
    expect(plan.metadata.totalShots).toBe(plan.shots.length)
  })

  test('每个 shot 包含完整能力表', () => {
    const graph = makeTestGraph()
    const plan = planFromGraph(graph)
    for (const shot of plan.shots) {
      // 所有已知能力都有值
      for (const cap of Object.keys(FILM_CAPABILITIES)) {
        expect(shot.needs).toHaveProperty(cap)
        expect(['full', 'partial', 'none']).toContain(shot.needs[cap])
      }
      // 都有 rationale
      expect(shot.rationale.length).toBeGreaterThan(0)
    }
  })

  test('Provider 名称不在代码输出中', () => {
    const graph = makeTestGraph()
    const plan = planFromGraph(graph)
    const serialized = JSON.stringify(plan)
    const providerNames = ['veo', 'seedance', 'aliyun', 'kling', 'sora', 'pika', 'runway']
    for (const name of providerNames) {
      expect(serialized.toLowerCase()).not.toContain(name)
    }
  })

  test('确定性：相同 Graph 产生相同 Plan', () => {
    const graph = makeTestGraph()
    const a = planFromGraph(graph)
    const b = planFromGraph(graph)
    expect(a.shots.length).toBe(b.shots.length)
    expect(a.metadata.totalShots).toBe(b.metadata.totalShots)
  })

  test('角色节点有 character_reference 需求', () => {
    const graph = makeTestGraph()
    const plan = planFromGraph(graph)
    const charShots = plan.shots.filter(s => {
      const node = graph.nodes.get(s.shotId)
      return node?.type === 'character'
    })
    for (const shot of charShots) {
      expect(shot.needs.character_reference).toBe('full')
    }
  })

  test('事件节点有关键帧需求', () => {
    const graph = makeTestGraph()
    const plan = planFromGraph(graph)
    const eventShots = plan.shots.filter(s => {
      const node = graph.nodes.get(s.shotId)
      return node?.type === 'event'
    })
    for (const shot of eventShots) {
      expect(shot.needs.keyframe).toBe('full')
    }
  })

  test('纯函数：不修改输入 Graph', () => {
    const graph = makeTestGraph()
    const originalSize = graph.nodes.size
    planFromGraph(graph)
    expect(graph.nodes.size).toBe(originalSize)
  })
})
