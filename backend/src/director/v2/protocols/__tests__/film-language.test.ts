import { describe, it, expect } from 'vitest'
import {
  FilmLanguageIR,
  FilmLanguageFrame,
  FilmLanguageProtocol,
  validateFilmLanguageIR,
  deterministicFingerprint,
  computeFilmLanguageFingerprint,
} from '../film-language'

function makeSampleFrame(overrides?: Partial<FilmLanguageFrame>): FilmLanguageFrame {
  const frame: FilmLanguageFrame = {
    frameIndex: 0,
    subject: {
      primary: { name: '沈三笑', assetNodeId: 'char_1', visualWeight: 0.55, appearance: '靛蓝长衫，身形清瘦' },
      secondary: [
        { name: '老槐树', assetNodeId: 'scene_1', visualWeight: 0.35, appearance: '古槐，枝干虬结，嫩芽初绽' },
        { name: '茶馆', assetNodeId: 'scene_2', visualWeight: 0.10, appearance: '青瓦木门，古旧茶馆' },
      ],
    },
    camera: { composition: '古槐占据画面左2/3，人物在右下1/3', shotType: 'Low Angle Reveal', narrativeIntention: '以老槐树的永恒衬托人物的短暂' },
    motion: { camera: '极慢匀速上升，带呼吸感', character: '微风吹衣角，目光缓缓移动', environment: '嫩芽轻摇，树梢微颤', particles: '晨光中细微灰尘漂浮' },
    environment: { scene: '乌有城老茶馆前', timeOfDay: '春日清晨', weather: '晴，薄云' },
    lighting: { source: '春日清晨的漫射天光', quality: '柔光，略带散射', direction: '顶光偏侧，柔和均匀' },
    emotion: { mood: '宁静春日，生机与深邃' },
    visualAnchors: {
      anchors: [
        { name: '沈三笑', type: 'character', assetNodeId: 'char_1', role: 'primary', continuityKey: 'shen_sanxiao_appearance' },
        { name: '老槐树', type: 'scene', assetNodeId: 'scene_1', role: 'secondary', continuityKey: 'old_locust_tree' },
      ],
    },
    continuity: {
      constraints: [
        { element: '沈三笑服装', description: '靛蓝色长衫不变', priority: 'must' },
        { element: '老槐树位置', description: '茶馆门前左侧', priority: 'must' },
      ],
    },
    narrative: { short: '沈三笑站在茶馆门口凝视老槐树', dialogue: '' },
    meta: { decisionId: 'dec_001', planId: 'plan_001', producer: 'FilmLanguageCompiler', version: '1.0.0' },
    ...overrides,
  }
  return frame
}

describe('FilmLanguage Protocol — 第七条冻结原则', () => {

  it('FilmLanguageFingerprint 应忽略 meta 中的可变字段', () => {
    const ir1: FilmLanguageIR = {
      frames: [makeSampleFrame()],
      meta: { decisionId: 'dec_001', planId: 'plan_001', producer: 'test', version: '1.0.0', createdAt: '2026-06-29T12:00:00Z' },
    }
    const ir2: FilmLanguageIR = {
      frames: [makeSampleFrame()],
      meta: { decisionId: 'dec_002', planId: 'plan_002', producer: 'test', version: '1.0.0', createdAt: '2026-06-29T12:05:00Z' },
    }
    const fp1 = computeFilmLanguageFingerprint(ir1)
    const fp2 = computeFilmLanguageFingerprint(ir2)
    expect(fp1).toBe(fp2)
  })

  it('不同内容应产生不同的 Fingerprint', () => {
    const ir1: FilmLanguageIR = {
      frames: [makeSampleFrame()],
      meta: { decisionId: 'dec_001', planId: 'plan_001', producer: 'test', version: '1.0.0', createdAt: '2026-06-29T12:00:00Z' },
    }
    const ir2: FilmLanguageIR = {
      frames: [makeSampleFrame({ camera: { composition: '不同构图', shotType: 'Close-up', narrativeIntention: '不同意图' } })],
      meta: { decisionId: 'dec_001', planId: 'plan_001', producer: 'test', version: '1.0.0', createdAt: '2026-06-29T12:00:00Z' },
    }
    expect(computeFilmLanguageFingerprint(ir1)).not.toBe(computeFilmLanguageFingerprint(ir2))
  })

  it('Protocol 定义中包含 informationPreserved 不变量', () => {
    expect(FilmLanguageProtocol.invariants.informationPreserved).toBe(true)
  })

  it('Protocol 定义中包含 fingerprintVersion', () => {
    expect(FilmLanguageProtocol.fingerprintVersion).toBe('1.0.0')
  })
})
