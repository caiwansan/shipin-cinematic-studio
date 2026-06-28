/**
 * CIR v1.0 验证测试
 */

import { describe, test, expect } from 'vitest'
import { validateCir } from '../cir-validator.js'
import type { CirV1 } from '../cir-v1.js'

function validCir(): CirV1 {
  return {
    version: '1.0',
    scene: {
      title: 'Test Scene',
      environment: {
        location: '室内书房',
        timeOfDay: '傍晚',
        weather: '晴',
        atmosphere: '温暖安静',
      },
    },
    characters: [
      { id: 'char_1', name: '主角', alias: 'Zhang', gender: '男', appearance: '休闲装', personality: ['冷静'], emotion: '平静', voiceGuide: '低沉' },
    ],
    shots: [
      {
        id: 'shot_1',
        description: '人物坐在书桌前',
        durationSeconds: 4,
        characterIds: ['char_1'],
        actions: ['reading'],
        dialogue: [],
        camera: {
          composition: { rule: 'rule_of_thirds' },
          scale: 'medium',
          angle: 'eye',
        },
        narrativePurpose: 'establish_character',
      },
    ],
    storyIntent: {
      story: 'protagonist_prepares',
      cinematic: 'calm_before_storm',
    },
    constraints: { fps: 24, resolution: '1920x1080' },
    metadata: {
      generatedBy: 'test',
      createdAt: new Date().toISOString(),
    },
  }
}

describe('CIR Validator', () => {
  test('有效 CIR 验证通过', () => {
    const result = validateCir(validCir())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('version 不匹配时失败', () => {
    const cir = validCir()
    cir.version = '0.5'
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path === 'version')).toBe(true)
  })

  test('缺少 scene.environment 字段时失败', () => {
    const cir = validCir()
    delete (cir.scene.environment as any).location
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('location'))).toBe(true)
  })

  test('缺少 storyIntent.cinematic 时失败', () => {
    const cir = validCir()
    delete (cir.storyIntent as any).cinematic
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('cinematic'))).toBe(true)
  })

  test('空 shots 数组失败', () => {
    const cir = validCir()
    cir.shots = []
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path === 'shots')).toBe(true)
  })

  test('shot 缺少 camera 时失败', () => {
    const cir = validCir()
    delete (cir.shots[0] as any).camera
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('camera'))).toBe(true)
  })

  test('shot durationSeconds 必须为正数', () => {
    const cir = validCir()
    cir.shots[0].durationSeconds = 0
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('durationSeconds'))).toBe(true)
  })

  test('缺少 characters.id 时报错', () => {
    const cir = validCir()
    delete (cir.characters[0] as any).id
    const result = validateCir(cir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('characters'))).toBe(true)
  })

  test('包含 prompt 字段时产生警告', () => {
    const cir = validCir() as any
    cir.prompt = 'some prompt text'
    const result = validateCir(cir)
    expect(result.warnings.some(w => w.path === 'prompt')).toBe(true)
  })

  test('null 输入失败', () => {
    const result = validateCir(null)
    expect(result.valid).toBe(false)
  })
})
