// Pipeline Production Loop Schema v1
// 三郎定义的 "强流程约束" 生产闭环
// 一个 Project = 一条生产线，五步固定流

// ── Project（项目 = 订单单位）──
export interface ProductionProject {
  id: string
  name: string
  type: 'short_drama' | 'ad' | 'product_video' | 'voiceover' | 'custom'
  status: 'draft' | 'producing' | 'done' | 'failed'
  createdAt: string
  updatedAt: string
  userId: string
  pipelineId: string      // → 关联当前 ProductionPipeline
}

// ── Pipeline（生产流 = 五步固定节点）──
export const PRODUCTION_STEPS = [
  'brief',
  'script',
  'storyboard',
  'render',
  'export',
] as const

export type ProductionStep = typeof PRODUCTION_STEPS[number]

export interface ProductionPipeline {
  id: string
  projectId: string
  name: string
  currentStep: ProductionStep    // 当前在哪一步
  steps: Record<ProductionStep, ProductionStepState>
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
}

// ── Step State（每一步的状态）──
export interface ProductionStepState {
  status: 'pending' | 'generating' | 'ready' | 'approved' | 'failed'
  input?: string                    // 用户输入
  output?: any                      // AI 生成输出
  history: ProductionStepHistory[]  // 生成历史（可回退）
  cost?: number
  startedAt?: string
  completedAt?: string
}

export interface ProductionStepHistory {
  id: string
  timestamp: string
  action: 'generate' | 'regenerate' | 'edit' | 'approve'
  input?: string
  output?: any
  durationMs?: number
}

// ── Step Outputs（每步产出结构）──

export interface BriefOutput {
  premise: string
  genre: string
  duration: string
  tone: string
  characters: { name: string; description: string }[]
}

export interface ScriptOutput {
  scenes: ScriptScene[]
  summary: string
}

export interface ScriptScene {
  number: number
  title: string
  location: string
  characters: string[]
  narration: string
  dialogue: { character: string; line: string }[]
  duration: string
}

export interface StoryboardOutput {
  shots: StoryboardShot[]
}

export interface StoryboardShot {
  shotNumber: number
  sceneNumber: number
  description: string
  emotion?: string
  camera?: string
  duration?: string
  prompt?: string         // 给渲染模型的 prompt
  lighting?: string       // 光线描述
}

export interface RenderOutput {
  assets: RenderAsset[]
}

export interface RenderAsset {
  type: 'video' | 'image' | 'audio'
  url: string
  duration?: string
  size?: string
}

export interface ExportOutput {
  videoUrl: string
  subtitleUrl?: string
  thumbnailUrl?: string
  packageUrl?: string
  format: string
  size: string
}

// ── API DTOs ──

export interface CreateProjectDTO {
  name: string
  type: ProductionProject['type']
  brief: string         // 一句话需求
}

export interface GenerateStepDTO {
  projectId: string
  step: ProductionStep
  input?: string        // 用户提供的补充输入
}

export interface ApproveStepDTO {
  projectId: string
  step: ProductionStep
  historyId?: string    // 从历史中选择一个版本
}

export interface ProjectResponse {
  project: ProductionProject
  pipeline: ProductionPipeline
}
