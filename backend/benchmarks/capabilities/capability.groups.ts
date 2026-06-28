import type { CapabilityGroup } from './capability.types.js'

/**
 * Group 分组定义 — 逻辑含义说明
 */

export interface CapabilityGroupInfo {
  id: CapabilityGroup
  name: string
  description: string
  /** 排序权重（越小越优先） */
  order: number
}

const GROUPS: CapabilityGroupInfo[] = [
  { id: 'camera', name: 'Camera', description: '摄像机运动与构图', order: 1 },
  { id: 'character', name: 'Character', description: '角色形象与表演', order: 2 },
  { id: 'lighting', name: 'Lighting', description: '光照方向与控制', order: 3 },
  { id: 'spatial', name: 'Spatial', description: '空间布局与物体关系', order: 4 },
  { id: 'temporal', name: 'Temporal', description: '时间轴与连续性', order: 5 },
  { id: 'render', name: 'Render', description: '渲染与画面输出', order: 6 },
  { id: 'physics', name: 'Physics', description: '物理模拟与环境', order: 7 },
  { id: 'emotion', name: 'Emotion', description: '情感对齐与叙事', order: 8 },
  { id: 'style', name: 'Style', description: '风格迁移与美术', order: 9 },
  { id: 'post', name: 'Post', description: '后期与特效', order: 10 },
  { id: 'action', name: 'Action', description: '动作与节奏', order: 11 },
  { id: 'audio', name: 'Audio', description: '音频与音效', order: 12 },
  { id: 'dialogue', name: 'Dialogue', description: '对话与唇音同步', order: 13 },
  { id: 'world', name: 'World', description: '世界状态与一致性', order: 14 },
]

export function getGroupInfo(group: CapabilityGroup): CapabilityGroupInfo | undefined {
  return GROUPS.find(g => g.id === group)
}

export const CAPABILITY_GROUPS = GROUPS
