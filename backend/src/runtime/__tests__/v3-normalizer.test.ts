/**
 * V3 Normalizer 测试
 */

import { describe, test, expect } from 'vitest'
import { normalizeV3 } from '../../runtime/v3-normalizer.js'
import type { NarrativeConstitutionV3 } from '../../agents/narrative-schema-v3.js'

const BASE_V3: NarrativeConstitutionV3 = {
  title: '测试', storyArc: { setup: '', conflict: '', climax: '', resolution: '' },
  characters: [],
  scenes: [],
  segments: [{
    id: 'seg_001', sceneId: 'scene_001', segmentNumber: 1, duration: 5,
    characters: [{ characterId: 'char_001', role: 'primary', emotion: '开心', focus: 0.9 }],
    environment: { location: 'A', lighting: '自然光', atmosphere: '轻松', weather: '晴', timeOfDay: '白天' },
    camera: { shot: '特写', movement: '推', angle: '平视', lens: '50mm' },
    action: { primary: '微笑' },
    dialogue: '', emotion: { type: '开心', intensity: 0.7 },
    visualDesc: 'test',
  }],
  soundDesign: [], effectsDesign: [], voices: [], props: [],
}

describe('normalizeV3', () => {
  test('运镜中文别名 → V3 标准值', () => {
    const n = normalizeV3(BASE_V3)
    expect(n.segments[0].camera.movement).toBe('push_in')
    expect(n.segments[0].camera.shot).toBe('close_up')
    expect(n.segments[0].camera.angle).toBe('eye_level')
  })

  test('情绪中文别名 → V3 标准值', () => {
    const n = normalizeV3(BASE_V3)
    expect(n.segments[0].characters[0].emotion).toBe('joy')
    expect(n.segments[0].emotion.type).toBe('joy')
  })

  test('已经标准的值不变', () => {
    const v3 = JSON.parse(JSON.stringify(BASE_V3)) as NarrativeConstitutionV3
    v3.segments[0].camera.movement = 'tracking'
    v3.segments[0].characters[0].emotion = 'fear'
    const n = normalizeV3(v3)
    expect(n.segments[0].camera.movement).toBe('tracking')
    expect(n.segments[0].characters[0].emotion).toBe('fear')
  })

  test('不修改原始输入', () => {
    const original = JSON.parse(JSON.stringify(BASE_V3))
    const n = normalizeV3(original)
    expect(n.segments[0].camera.movement).toBe('push_in')
    expect(original.segments[0].camera.movement).toBe('推')
  })

  test('空字符串不崩溃', () => {
    const v3 = JSON.parse(JSON.stringify(BASE_V3)) as NarrativeConstitutionV3
    v3.segments[0].camera.movement = ''
    const n = normalizeV3(v3)
    expect(n.segments[0].camera.movement).toBe('')
  })

  test('所有中文情绪别名覆盖', () => {
    const cases: [string, string][] = [
      ['开心', 'joy'], ['快乐', 'joy'], ['高兴', 'joy'],
      ['愤怒', 'anger'], ['生气', 'anger'],
      ['悲伤', 'sadness'], ['难过', 'sadness'],
      ['害怕', 'fear'], ['恐惧', 'fear'],
      ['厌恶', 'disgust'], ['讨厌', 'disgust'],
      ['惊讶', 'surprise'], ['震惊', 'shock'], ['惊喜', 'surprise'],
      ['平静', 'calm'], ['冷静', 'calm'], ['淡定', 'calm'],
      ['中性', 'neutral'],
    ]
    for (const [input, expected] of cases) {
      const v3 = JSON.parse(JSON.stringify(BASE_V3)) as NarrativeConstitutionV3
      v3.segments[0].emotion.type = input
      const n = normalizeV3(v3)
      expect(n.segments[0].emotion.type).toBe(expected)
    }
  })
})
