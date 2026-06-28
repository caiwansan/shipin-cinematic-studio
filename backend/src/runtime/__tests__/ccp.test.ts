/**
 * CCP — Cinematic Compilation Pipeline 测试
 */

import { describe, test, expect } from 'vitest'
import { compileToSemanticIr } from '../ccp-semantic-ir.js'
import { compileToProviderIr, VOLCENGINE_CAPS } from '../ccp-provider-ir.js'
import { renderPrompt, optimizePrompt, buildCompileReport } from '../ccp-render.js'
import { VolcengineCompiler, compileCir } from '../ccp-compiler.js'
import type { CirV1 } from '../cir-v1.js'

function sampleCir(): CirV1 {
  return {
    version: '1.0',
    scene: {
      title: 'Evening Conversation',
      environment: { location: 'indoor study', timeOfDay: 'evening', weather: 'clear', atmosphere: 'warm intimate' },
    },
    characters: [
      { id: 'char_1', name: 'Alice', alias: 'A', gender: 'female', appearance: 'warm sweater', personality: ['thoughtful'], emotion: 'calm' },
    ],
    shots: [
      {
        id: 'shot_1',
        description: 'Alice sitting at desk',
        durationSeconds: 4,
        characterIds: ['char_1'],
        actions: ['reading'],
        dialogue: [],
        camera: {
          composition: { rule: 'rule_of_thirds', subjectPosition: 'left_third', lookRoomDirection: 'right' },
          scale: 'close_up',
          angle: 'eye',
          focus: { target: 'face', depthOfField: 'shallow' },
          motion: { pattern: 'static' },
        },
        lighting: { keyLightDirection: 'left', colorTemperature: 'warm', mood: 'intimate', continuity: true },
        narrativePurpose: 'establish_mood',
      },
    ],
    storyIntent: { story: 'quiet_evening', cinematic: 'intimacy' },
    constraints: { fps: 24, resolution: '1920x1080', maxDuration: 10 },
    metadata: { generatedBy: 'test', createdAt: new Date().toISOString() },
  }
}

describe('CCP: Semantic IR', () => {
  test('CIR → Semantic IR 保持 shot 数量', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    expect(semir.shots.length).toBe(1)
    expect(semir.scene.title).toBe('Evening Conversation')
  })

  test('Semantic IR 不含 prompt 字段', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    expect((semir as any).prompt).toBeUndefined()
    expect((semir as any).negativePrompt).toBeUndefined()
  })

  test('Semantic IR 包含环境摘要', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    expect(semir.scene.environmentSummary).toContain('indoor study')
    expect(semir.scene.environmentSummary).toContain('warm intimate')
  })

  test('镜头运动描述不含 Provider 特定术语', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const motion = semir.shots[0].camera.motionDescription
    expect(motion).toContain('close_up')
    expect(motion).toContain('eye')
    expect(motion).toContain('rule_of_thirds')
  })
})

describe('CCP: Provider IR', () => {
  test('Semantic IR → Provider IR 产生指令', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const pir = compileToProviderIr(semir, VOLCENGINE_CAPS)
    expect(pir.shotInstructions.length).toBe(1)
    expect(pir.shotInstructions[0].shotId).toBe('shot_1')
  })

  test('不支持的 Rack Focus 触发 Capability Loss', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const pir = compileToProviderIr(semir, VOLCENGINE_CAPS)
    const losses = pir.globalCapabilityLosses
    expect(losses.some(l => l.capability === 'rack_focus')).toBe(true)
  })

  test('Global instructions 包含叙事意图', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const pir = compileToProviderIr(semir, VOLCENGINE_CAPS)
    expect(pir.globalInstructions.some(i => i.includes('quiet_evening'))).toBe(true)
  })
})

describe('CCP: Render + Optimize', () => {
  test('Prompt Renderer 输出纯文本', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const pir = compileToProviderIr(semir, VOLCENGINE_CAPS)
    const { prompt, negativePrompt } = renderPrompt(pir, 1000)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
    expect(negativePrompt).toContain('blurry')
  })

  test('Optimizer 压缩长文本', () => {
    const longText = 'a\n\nb\n\nc'
    const opt = optimizePrompt(longText, 100)
    expect(opt).not.toContain('\n\n')
  })

  test('Compile Report 计算评分', () => {
    const cir = sampleCir()
    const semir = compileToSemanticIr(cir)
    const pir = compileToProviderIr(semir, VOLCENGINE_CAPS)
    const report = buildCompileReport(pir, cir.shots.length, 1000)
    expect(report.compileScore).toBeGreaterThanOrEqual(0)
    expect(report.compileScore).toBeLessThanOrEqual(100)
    expect(report.inputShotCount).toBe(1)
  })
})

describe('CCP: Full Pipeline', () => {
  test('VolcengineCompiler 完整编译', () => {
    const cir = sampleCir()
    const result = new VolcengineCompiler().compile(cir)
    expect(result.semanticIR.shots.length).toBe(1)
    expect(result.providerIR.shotInstructions.length).toBe(1)
    expect(result.prompt.length).toBeGreaterThan(0)
    expect(result.optimizedPrompt.length).toBeGreaterThan(0)
    expect(result.report.compileScore).toBeGreaterThan(0)
  })

  test('compileCir 入口函数可用', () => {
    const cir = sampleCir()
    const result = compileCir(cir)
    expect(result.semanticIR).toBeDefined()
    expect(result.providerIR).toBeDefined()
    expect(result.prompt).toBeDefined()
    expect(result.report).toBeDefined()
  })

  test('Capability Diff 可区分支持与不支持', () => {
    const cir = sampleCir()
    const result = compileCir(cir)
    expect(result.report.supportedCapabilities).toContain('lighting_control')
    expect(result.report.supportedCapabilities).not.toContain('rack_focus')
    expect(result.report.lostCapabilities.length).toBeGreaterThan(0)
  })
})
