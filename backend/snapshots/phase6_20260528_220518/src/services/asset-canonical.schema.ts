/**
 * A1-1 asset-canonical.schema.ts — 纯类型层（全系统最底层）
 *
 * 定义 AssetType / AssetStatus 枚举 + 5 类 Canonical 接口。
 * 0 外部依赖，可被任意模块 import。
 */

// ─── 核心枚举 ───

export type AssetType =
  | 'character'
  | 'scene'
  | 'prop'
  | 'storyboard'
  | 'shot'
  | 'keyframe'

export type AssetStatus =
  | 'draft'
  | 'processing'
  | 'optimized'
  | 'approved'
  | 'generating'
  | 'partial_failed'
  | 'generated'
  | 'failed'
  | 'locked'
  | 'archived'

// ─── 五类 Canonical 接口 ───

export interface AssetCanonicalCharacter {
  id: string
  name: string
  appearance: string
  personality: string
  background: string
  relationship: string
  imagePrompt: string
  voiceDesign?: string
}

export interface AssetCanonicalScene {
  id: string
  name: string
  atmosphere: string
  visualStyle: string
  timeOfDay: string
  environment: string
  imagePrompt: string
}

export interface AssetCanonicalStoryboard {
  id: string
  shotIndex: number
  description: string
  cameraMovement: string
  duration: string
  lighting: string
  emotion: string
  prompt: string
}

export interface AssetCanonicalKeyframe {
  id: string
  segmentIndex: number
  type: 'head' | 'tail'
  description: string
  design: string
  prompt: string
  inheritedFrom?: string
}

export interface AssetCanonicalShot {
  id: string
  sequenceIndex: number
  caption: string
  duration: string
  motionDesign: string
  visualDesign: string
  soundDesign: string
  dialogue: string
  prompt: string
}

// ─── 统一主体（包裹层） ───

export interface AssetCanonical {
  id: string
  projectId: string
  type: AssetType
  status: AssetStatus
  content: Record<string, any>
  prompt: Record<string, any>
  currentVersionId?: string
  createdAt: number
  updatedAt: number
}

// ─── 状态可读标签 ───

export const AssetStatusLabels: Record<AssetStatus, string> = {
  draft: '待处理',
  processing: '处理中',
  optimized: '已优化',
  approved: '已确认',
  generating: '生成中',
  partial_failed: '部分失败',
  generated: '已生成',
  failed: '失败',
  locked: '已锁定',
  archived: '已归档',
}
