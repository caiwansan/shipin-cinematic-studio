/**
 * Compiler v0 测试 — compileFromV3()
 *
 * 验证三项核心性质：
 *   ① Deterministic：同 V3 → 同 FilmIR
 *   ② Complete Mapping：所有 10 个 filmIR 模块都被填充
 *   ③ Side-effect Free：不抛出、不超时
 */

import { describe, test, expect } from 'vitest'
import { compileFromV3 } from '../../runtime/film-ir-compiler.js'
import type { NarrativeConstitutionV3 } from '../../agents/narrative-schema-v3.js'

// ─── 固定测试输入 ────────────────────────────────────────

const EXAMPLE_V3: NarrativeConstitutionV3 = {
  title: '测试故事',
  storyArc: { setup: '古装场景，茶馆相遇', conflict: '意见不合', climax: '对峙', resolution: '和解' },
  characters: [
    { id: 'char_001', name: '沈三笑', alias: '三笑', age: '25', appearance: '面容清秀，青色长衫，长发束起', personality: ['沉稳', '温和'], voiceGuide: '声线平稳' },
    { id: 'char_002', name: '赵无眠', alias: '无眠', age: '30', appearance: '身形高大，黑衣劲装，面有刀疤', personality: ['急躁', '刚烈'], voiceGuide: '声线低沉' },
  ],
  scenes: [
    {
      id: 'scene_001', name: '茶馆门口', location: '乌有城老街', environment: {
        location: '老茶馆门前石板路',
        lighting: '傍晚暖色柔光',
        atmosphere: '宁静略带苍凉',
        colorPalette: '青灰、暖橙',
        weather: '晴',
        timeOfDay: '傍晚',
      }
    },
    {
      id: 'scene_002', name: '巷口', location: '老城巷口', environment: {
        location: '青石板小巷，墙角有青苔',
        lighting: '夕阳斜照',
        atmosphere: '紧张',
        colorPalette: '灰蓝、暗金',
        weather: '晴',
        timeOfDay: '傍晚',
      }
    },
  ],
  segments: [
    {
      id: 'seg_001', sceneId: 'scene_001', segmentNumber: 1, duration: 8,
      characters: [{ characterId: 'char_001', role: 'primary', emotion: '平静', focus: 0.9, action: '缓步走向茶馆' }],
      environment: { location: '老茶馆门口石板路', lighting: '傍晚暖色柔光', atmosphere: '宁静', weather: '晴', timeOfDay: '傍晚' },
      camera: { shot: 'medium', movement: 'dolly', angle: 'eye_level', lens: '50mm' },
      action: { primary: '推门', interaction: '右手推开木门', expression: '目光温和' },
      dialogue: '',
      emotion: { type: 'calm', intensity: 0.7 },
      visualDesc: '傍晚时分，沈三笑缓步走向老茶馆，右手推开木门。',
    },
    {
      id: 'seg_002', sceneId: 'scene_002', segmentNumber: 2, duration: 10,
      characters: [
        { characterId: 'char_002', role: 'primary', emotion: '愤怒', focus: 0.8, action: '快步追来' },
        { characterId: 'char_001', role: 'secondary', emotion: '惊讶', focus: 0.4, action: '转身' },
      ],
      environment: { location: '青石板小巷', lighting: '夕阳斜照', atmosphere: '紧张', weather: '晴', timeOfDay: '傍晚' },
      camera: { shot: 'close_up', movement: 'handheld', angle: 'low_angle', lens: '85mm' },
      action: { primary: '追逐', interaction: '前方奔跑，后方追赶', expression: '紧张' },
      dialogue: '站住！',
      emotion: { type: 'anger', intensity: 0.8 },
      visualDesc: '赵无眠从后方快步追来，沈三笑惊讶转身。',
    },
  ],
  soundDesign: [
    { segmentId: 'seg_001', ambient: '街道环境音', music: '舒缓古筝', effect: '开门吱呀声' },
    { segmentId: 'seg_002', ambient: '小巷风声', music: '急促弦乐', effect: '脚步声' },
  ],
  effectsDesign: [
    { segmentId: 'seg_001', visualEffect: '夕阳柔光', transition: '淡入' },
    { segmentId: 'seg_002', visualEffect: '灰尘飞扬', transition: '硬切' },
  ],
  voices: [
    { characterId: 'char_001', voiceType: '青年男声', timbre: '温润', speed: '中等', speakingStyle: '平稳' },
    { characterId: 'char_002', voiceType: '成年男声', timbre: '低沉', speed: '较快', speakingStyle: '急促' },
  ],
  props: [
    { id: 'prop_001', name: '木门', category: '道具', description: '老茶馆木门', function: '开合', designNotes: '木质，有岁月痕迹' },
  ],
}

// 相同 V3 跑两次验证确定性
const V3_COPY: NarrativeConstitutionV3 = JSON.parse(JSON.stringify(EXAMPLE_V3))

describe('compileFromV3 — 确定性', () => {
  test('相同 V3 产生相同 FilmIR（字段级相等）', () => {
    const a = compileFromV3(EXAMPLE_V3)
    const b = compileFromV3(V3_COPY)

    // metadata.id 不同（时间戳），只校验 content 字段
    expect(a.metadata.id).not.toBe(b.metadata.id)
    expect(a.metadata.version).toBe(b.metadata.version)
    expect(a.metadata.createdBy).toBe(b.metadata.createdBy)
    expect(a.metadata.confidence).toBe(b.metadata.confidence)
    expect(a.metadata.schemaVersion).toBe(b.metadata.schemaVersion)

    // content 字段完全一致
    expect(a.global).toEqual(b.global)
    expect(a.scene).toEqual(b.scene)
    expect(a.characters).toEqual(b.characters)
    expect(a.camera).toEqual(b.camera)
    expect(a.lighting).toEqual(b.lighting)
    expect(a.action).toEqual(b.action)
    expect(a.environment).toEqual(b.environment)
    expect(a.style).toEqual(b.style)
    expect(a.constraints).toEqual(b.constraints)
    expect(a.references).toEqual(b.references)
  })

  test('确定性断言：重复 3 次结构一致', () => {
    const results = [0, 1, 2].map(() => compileFromV3(EXAMPLE_V3))
    for (let i = 1; i < results.length; i++) {
      expect(results[i].global).toEqual(results[0].global)
      expect(results[i].action.length).toBe(results[0].action.length)
      expect(results[i].characters.length).toBe(results[0].characters.length)
    }
  })
})

describe('compileFromV3 — 完整映射', () => {
  const ir = compileFromV3(EXAMPLE_V3)

  test('metadata 正确标记来源', () => {
    expect(ir.metadata.createdBy).toBe('film-compiler@0.1')
    expect(ir.metadata.source).toBe('film-compiler-v3')
    expect(ir.metadata.confidence).toBe(1.0)
    expect(ir.metadata.id).toMatch(/^filmir_/)
  })

  test('global: 从 segments 推导 totalDuration', () => {
    expect(ir.global.duration).toBe(18)  // 8 + 10
    expect(ir.global.mood).toBe('calm')  // 来自第一个 segment 的 emotion.type
  })

  test('scene: 从场景库映射', () => {
    expect(ir.scene.location).toBe('老茶馆门口石板路')
    expect(ir.scene.timeOfDay).toBe('傍晚')
    expect(ir.scene.weather).toBe('晴')
  })

  test('characters: segments 中出现的角色', () => {
    expect(ir.characters.length).toBe(2)
    expect(ir.characters[0].name).toBe('沈三笑')
    expect(ir.characters[1].name).toBe('赵无眠')
  })

  test('camera: 景别/运镜/角度映射正确', () => {
    expect(ir.camera.shotType).toBe('中景')
    expect(ir.camera.movement).toBe('推')
    expect(ir.camera.angle).toBe('平视')
    expect(ir.camera.focalLength).toBe('标准')
  })

  test('lighting: 从 segment.environment 映射', () => {
    expect(ir.lighting.keyLight).toBe('傍晚暖色柔光')
    expect(ir.lighting.mood).toBe('宁静')
  })

  test('action: 每个 segment 对应一个 action', () => {
    expect(ir.action.length).toBe(2)
    expect(ir.action[0].type).toBe('推门')
    expect(ir.action[0].subject).toBe('char_001')
  })

  test('environment: 从 segment 映射', () => {
    expect(ir.environment.atmosphere).toBe('宁静')
  })

  test('constraints: 从角色/场景/segments 推导', () => {
    expect(ir.constraints.identity.length).toBeGreaterThan(0)
    expect(ir.constraints.spatial.length).toBeGreaterThan(0)
    expect(ir.constraints.temporal.length).toBeGreaterThan(0)
  })

  test('references: 为空（V3 不包含资产引用）', () => {
    expect(ir.references).toEqual({})
  })
})

describe('compileFromV3 — 边界情况', () => {
  test('空 segments 不会崩溃', () => {
    const empty: NarrativeConstitutionV3 = {
      title: '空', storyArc: { setup: '', conflict: '', climax: '', resolution: '' },
      characters: [], scenes: [],
      segments: [],
      soundDesign: [], effectsDesign: [], voices: [], props: [],
    }
    const ir = compileFromV3(empty)
    expect(ir.global.duration).toBe(0)
    expect(ir.characters.length).toBe(0)
    expect(ir.action.length).toBe(0)
  })

  test('单 segment 可以编译', () => {
    const single: NarrativeConstitutionV3 = {
      title: '最小', storyArc: { setup: '', conflict: '', climax: '', resolution: '' },
      characters: [],
      scenes: [],
      segments: [{
        id: 'seg_001', sceneId: 'scene_001', segmentNumber: 1, duration: 5,
        characters: [],
        environment: { location: '某个地方', lighting: '自然光', atmosphere: '平静' },
        camera: { shot: 'wide', movement: 'static', angle: 'eye_level', lens: '50mm' },
        action: { primary: '站立' },
        dialogue: '',
        emotion: { type: 'neutral', intensity: 0.5 },
        visualDesc: '一个人在某个地方站着。',
      }],
      soundDesign: [], effectsDesign: [], voices: [], props: [],
    }
    const ir = compileFromV3(single)
    expect(ir.action.length).toBe(1)
    expect(ir.action[0].type).toBe('站立')
  })
})

describe('compileFromV3 — 冻结断言', () => {
  test('输出是冻结的不可变对象', () => {
    const ir = compileFromV3(EXAMPLE_V3)
    expect(Object.isFrozen(ir)).toBe(true)
    expect(Object.isFrozen(ir.global)).toBe(true)
    expect(Object.isFrozen(ir.camera)).toBe(true)
    expect(Object.isFrozen(ir.scene)).toBe(true)
  })
})
