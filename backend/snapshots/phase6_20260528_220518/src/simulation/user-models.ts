/**
 * User Behavior Models — 人格模拟器
 * 
 * 四类用户模型，模拟真实世界人类操作行为。
 * 每个模型定义：操作序列、间隔分布、重试策略、取消偏好、并发特征。
 */

// ============================================================
// 基础类型
// ============================================================

export type TaskType = 'text_script' | 'storyboard' | 'video_gen' | 'character_gen' | 'voiceover'

export interface UserAction {
  type: 'submit' | 'cancel' | 'retry' | 'refresh' | 'switch_tab' | 'close_page'
  taskType: TaskType
  timestamp: number
  delayMs: number       // 操作前等待时间
  taskId?: string       // 关联的 task（cancel/retry 用）
}

export interface UserModel {
  id: string
  name: string
  label: string
  emoji: string
  weight: number        // 在模拟中的占比权重

  // 行为参数
  submitIntervalMs: [number, number]     // 两次提交间隔 [min, max]
  cancelThresholdMs: number              // 超过这个时间无响应就 cancel
  retryProbability: number               // 0~1，重试概率
  retryMaxCount: number                  // 最多重试次数
  refreshFrequencyMs: [number, number]   // 刷新间隔范围
  burstSubmit: boolean                   // 是否连点 submit
  multiTab: boolean                      // 是否多 tab 并发

  // 任务类型偏好
  taskTypeWeights: Record<TaskType, number>
}

// ============================================================
// A类：理性用户（稳定）
// ============================================================

export const rationalUser: UserModel = {
  id: 'rational',
  name: 'rational',
  label: '理性用户',
  emoji: '🟢',
  weight: 0.25,

  submitIntervalMs: [8000, 25000],        // 8~25s 一次
  cancelThresholdMs: 120_000,             // 2分钟无响应才 cancel
  retryProbability: 0.05,                 // 几乎不重试
  retryMaxCount: 1,
  refreshFrequencyMs: [30000, 60000],     // 30~60s 刷新
  burstSubmit: false,
  multiTab: false,

  taskTypeWeights: {
    text_script: 0.3,
    storyboard: 0.25,
    video_gen: 0.2,
    character_gen: 0.15,
    voiceover: 0.1,
  },
}

// ============================================================
// B类：焦虑用户（最真实）
// ============================================================

export const anxiousUser: UserModel = {
  id: 'anxious',
  name: 'anxious',
  label: '焦虑用户',
  emoji: '🟡',
  weight: 0.35,             // 最大占比

  submitIntervalMs: [2000, 8000],          // 2~8s 频繁提交
  cancelThresholdMs: 15_000,               // 15s 就开始焦虑
  retryProbability: 0.6,                   // 60% 会重试
  retryMaxCount: 3,                        // 最多重试 3 次
  refreshFrequencyMs: [3000, 12000],       // 疯狂刷新页面
  burstSubmit: false,                       // 不连点，但频繁操作
  multiTab: false,

  taskTypeWeights: {
    text_script: 0.2,
    storyboard: 0.3,        // 分镜生成最容易焦虑
    video_gen: 0.35,        // 视频生成最焦虑
    character_gen: 0.1,
    voiceover: 0.05,
  },
}

// ============================================================
// C类：攻击型用户（系统杀手）
// ============================================================

export const aggressiveUser: UserModel = {
  id: 'aggressive',
  name: 'aggressive',
  label: '攻击型用户',
  emoji: '🔴',
  weight: 0.15,

  submitIntervalMs: [500, 3000],            // 疯狂连点
  cancelThresholdMs: 5_000,                 // 5s 就 cancel
  retryProbability: 0.9,                    // 90% 疯狂重试
  retryMaxCount: 5,                         // 最多重试 5 次
  refreshFrequencyMs: [1000, 5000],         // 极高频刷新
  burstSubmit: true,                        // 连点 submit
  multiTab: true,                           // 多 tab 并发

  taskTypeWeights: {
    text_script: 0.2,
    storyboard: 0.2,
    video_gen: 0.4,         // 盯视频最久 → 最容易怒
    character_gen: 0.1,
    voiceover: 0.1,
  },
}

// ============================================================
// D类：混沌用户（现实最常见）
// ============================================================

export const chaoticUser: UserModel = {
  id: 'chaotic',
  name: 'chaotic',
  label: '混沌用户',
  emoji: '⚫',
  weight: 0.25,

  submitIntervalMs: [1000, 20000],          // 随机间隔
  cancelThresholdMs: 10_000,                // 10s 决定 cancel
  retryProbability: 0.4,                    // 40% 重试
  retryMaxCount: 2,
  refreshFrequencyMs: [2000, 30000],        // 随机刷新
  burstSubmit: Math.random() > 0.5,         // 随机连点
  multiTab: Math.random() > 0.7,            // 偶尔多 tab

  taskTypeWeights: {
    text_script: 0.25,
    storyboard: 0.25,
    video_gen: 0.25,
    character_gen: 0.15,
    voiceover: 0.1,
  },
}

// ============================================================
// 用户模型注册表
// ============================================================

export const ALL_USER_MODELS: UserModel[] = [
  rationalUser,
  anxiousUser,
  aggressiveUser,
  chaoticUser,
]

export function getUserModelById(id: string): UserModel | undefined {
  return ALL_USER_MODELS.find(m => m.id === id)
}

/**
 * 按权重随机选择一个用户模型
 */
export function pickUserModel(): UserModel {
  const totalWeight = ALL_USER_MODELS.reduce((s, m) => s + m.weight, 0)
  let r = Math.random() * totalWeight
  for (const model of ALL_USER_MODELS) {
    r -= model.weight
    if (r <= 0) return model
  }
  return ALL_USER_MODELS[ALL_USER_MODELS.length - 1]
}

/**
 * 按用户模型的 taskTypeWeights 选择一个任务类型
 */
export function pickTaskType(model: UserModel): TaskType {
  const weights = model.taskTypeWeights
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (const [type, weight] of Object.entries(weights)) {
    r -= weight
    if (r <= 0) return type as TaskType
  }
  return 'text_script'
}
