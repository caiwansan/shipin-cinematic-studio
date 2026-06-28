import type { CapabilityDefinition } from './capability.types.js'

/**
 * 标签工具 — 将 Capability ID 映射到人类可读标签。
 * 用于 Dataset metadata 的自动补全和校验。
 */

// 定义额外说明信息（可独立于 Registry 扩展）
export interface CapabilityTag {
  id: string
  label: string
  keywords: string[]
  /** 推荐出现在哪些类型的 Dataset 中 */
  recommendedScenario: string[]
}

const TAGS: Record<string, CapabilityTag> = {
  CAMERA_PATH: {
    id: 'CAMERA_PATH',
    label: '摄像机路径',
    keywords: ['运动镜头', '运镜', '推拉', '摇移', '跟踪'],
    recommendedScenario: ['动作场景', '追逐戏', '长镜头'],
  },
  CHARACTER_REFERENCE: {
    id: 'CHARACTER_REFERENCE',
    label: '角色引用',
    keywords: ['角色一致性', '人物', '外形', '形象'],
    recommendedScenario: ['所有场景'],
  },
  RENDER_SHOT: {
    id: 'RENDER_SHOT',
    label: '镜头渲染',
    keywords: ['渲染', '输出', '画面'],
    recommendedScenario: ['所有场景'],
  },
  SPATIAL_LAYOUT: {
    id: 'SPATIAL_LAYOUT',
    label: '空间布局',
    keywords: ['位置关系', '空间', '场景布局'],
    recommendedScenario: ['对话场景', '群戏'],
  },
  TEMPORAL_CONSISTENCY: {
    id: 'TEMPORAL_CONSISTENCY',
    label: '时间一致性',
    keywords: ['帧间稳定', '闪烁', '抖动'],
    recommendedScenario: ['长镜头', '连续动作'],
  },
  SHOT_TRANSITION: {
    id: 'SHOT_TRANSITION',
    label: '镜头切换',
    keywords: ['过渡', '转场', '切换'],
    recommendedScenario: ['场景切换', '蒙太奇'],
  },
  LIGHT_CONTINUITY: {
    id: 'LIGHT_CONTINUITY',
    label: '光照连续性',
    keywords: ['光照', '光线一致', '不打闪'],
    recommendedScenario: ['室内场景', '夜景'],
  },
  STYLE_TRANSFER: {
    id: 'STYLE_TRANSFER',
    label: '风格迁移',
    keywords: ['风格', '滤镜', '美术风格'],
    recommendedScenario: ['风格化内容', '转场效果'],
  },
}

export function getTag(id: string): CapabilityTag | undefined {
  return TAGS[id]
}

export function searchByKeyword(keyword: string): CapabilityTag[] {
  const kw = keyword.toLowerCase()
  return Object.values(TAGS).filter(
    t =>
      t.label.includes(kw) ||
      t.keywords.some(k => k.includes(kw)),
  )
}

export function recommendForScenario(scenario: string): CapabilityTag[] {
  const s = scenario.toLowerCase()
  return Object.values(TAGS).filter(
    t => t.recommendedScenario.some(rs => rs.includes(s)),
  )
}
