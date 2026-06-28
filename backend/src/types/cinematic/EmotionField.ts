// ============================================================
// EmotionField.ts — 情绪渲染场结构
// Phase 5: 情绪成为运行时系统变量
//
// EmotionField 是一个 overlay system：
// - 不修改 IR / ShotGraph / TimelineGraph
// - 消费三者的输出，生成逐秒情绪调制参数
// - 输出给 PromptFrames → Video 层
//
// 铁律：
// 1. 情绪 = 函数输出（不是静态标签）
// 2. 不存 prompt/image/video 结果
// 3. 为 Phase 6 音画同步提供情绪驱动接口
// ============================================================

// ─── EmotionKeyframe（逐秒情绪调制）───────────────────
export interface EmotionKeyframe {
  /** 时间轴（秒） */
  t: number
  /** 光影偏移 0-1（0=暗, 1=亮） */
  lightingShift: number
  /** 色温：warm/cool/neutral */
  colorTemperature: 'warm' | 'cool' | 'neutral'
  /** 对比度 0-1 */
  contrast: number
  /** 饱和度 0-1 */
  saturation: number
  /** 镜头能量 0-1（影响 camera shake / movement intensity） */
  cameraEnergy: number
  /** 音频强度 0-1（为 Phase 6 预留） */
  audioIntensity: number
}

// ─── EmotionField（顶层容器）─────────────────────────
export interface EmotionField {
  projectId: string
  /** 全局基调 0-1（0=压抑, 1=明亮） */
  globalTone: number
  /** 全局张力 0-1 */
  globalTension: number
  /** 全局亲密感 0-1（0=疏离, 1=亲密） */
  globalIntimacy: number
  /** 全局不稳定性 0-1 */
  globalInstability: number
  /** 逐秒情绪曲线 */
  curve: EmotionKeyframe[]
  meta: {
    totalDuration: number
    keyframeCount: number
    /** 情绪变化幅度 0-1（高=情绪丰富，低=平淡） */
    dynamicRange: number
  }
}
