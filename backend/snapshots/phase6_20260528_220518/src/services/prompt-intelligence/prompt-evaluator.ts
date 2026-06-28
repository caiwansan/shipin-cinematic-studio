// ============================================================
// 📦 Prompt Evaluator — 结果评估器
//
// 职责：给生成结果打分（质量、一致性、真实感）
// v1：规则评分 + 基础视觉特征
// v2：AI Vision 模型评分
// ============================================================

export interface EvaluationResult {
  qualityScore: number       // 0-10 总体质量
  consistencyScore: number   // 0-10 与 prompt 的一致性
  realismScore: number       // 0-10 真实感
  detailScore: number        // 0-10 细节丰富度
  compositionScore: number   // 0-10 构图
  totalScore: number         // 加权总分
  summaries: string[]        // 评价摘要
}

interface EvalOptions {
  prompt: string
  optimizedPrompt?: string
  taskType: 'image' | 'video'
  durationMs?: number
  mode?: string
}

export const promptEvaluator = {
  /**
   * 评估生成结果
   * v1：基于规则 + 元数据
   * v2（TODO）：接入 AI Vision API
   */
  async evaluate(options: EvalOptions): Promise<EvaluationResult> {
    const { prompt, taskType, durationMs } = options
    const summaries: string[] = []

    // 1. 基础质量评分
    let qualityScore = 7.0

    // prompt 长度适中通常质量更好
    if (prompt.length > 50 && prompt.length < 500) qualityScore += 1.0
    else if (prompt.length < 20) qualityScore -= 1.0

    // 包含关键质量词
    const qualityKeywords = ['detailed', 'cinematic', 'high quality', '8k', 'masterpiece',
      '细腻', '高画质', '电影级', '写实']
    const hasQualityKeywords = qualityKeywords.some(k => prompt.toLowerCase().includes(k))
    if (hasQualityKeywords) qualityScore += 0.5

    // 包含风格/场景描述
    const sceneKeywords = ['lighting', 'sunset', 'mood', 'atmosphere', '背景', '光线', '氛围']
    const hasSceneKeywords = sceneKeywords.some(k => prompt.toLowerCase().includes(k))
    if (hasSceneKeywords) qualityScore += 0.5

    qualityScore = Math.max(0, Math.min(10, qualityScore))

    // 2. 一致性评分（prompt 细节丰富度）
    const tokenCount = prompt.split(/[\s,，。、]+/).filter(Boolean).length
    let consistencyScore = 5.0
    if (tokenCount > 20) consistencyScore = 7.5
    if (tokenCount > 40) consistencyScore = 9.0
    if (tokenCount > 5) consistencyScore += 1.0
    if (tokenCount < 10) consistencyScore -= 1.0
    consistencyScore = Math.max(0, Math.min(10, consistencyScore))

    // 3. 真实感评分
    let realismScore = 6.0
    const realismKeywords = ['photorealistic', 'realistic', '真实', '写实', '摄影', 'photography']
    const hasRealism = realismKeywords.some(k => prompt.toLowerCase().includes(k))
    if (hasRealism) realismScore += 2.0
    realismScore = Math.max(0, Math.min(10, realismScore))

    // 4. 细节丰富度
    let detailScore = 5.0
    if (tokenCount > 30) detailScore = 8.0
    else if (tokenCount > 15) detailScore = 6.5
    detailScore = Math.max(0, Math.min(10, detailScore))

    // 5. 构图评分
    let compositionScore = 6.0
    const compKeywords = ['close-up', 'wide shot', 'portrait', 'cinematic', 'angle', '构图', '特写', '远景']
    const hasComp = compKeywords.some(k => prompt.toLowerCase().includes(k))
    if (hasComp) compositionScore += 1.5
    compositionScore = Math.max(0, Math.min(10, compositionScore))

    // 6. 视频额外
    if (taskType === 'video') {
      const motionKeywords = ['motion', 'moving', 'pan', 'tracking', 'zoom', 'slow motion', '运动', '移动', '旋转']
      const hasMotion = motionKeywords.some(k => prompt.toLowerCase().includes(k))
      if (hasMotion) qualityScore += 0.5

      // 时长适中
      if (durationMs && durationMs >= 3000 && durationMs <= 7000) {
        qualityScore += 0.3
      }
    }

    // 加权总分
    const totalScore = (
      qualityScore * 0.30 +
      consistencyScore * 0.25 +
      realismScore * 0.20 +
      detailScore * 0.15 +
      compositionScore * 0.10
    )

    // 摘要
    if (qualityScore >= 8) summaries.push('✨ 高质量 prompt')
    else if (qualityScore >= 6) summaries.push('👍 质量良好')
    else summaries.push('📝 可进一步优化')

    if (consistencyScore < 6) summaries.push('🎯 建议增加细节描述')
    if (realismScore < 6 && taskType === 'image') summaries.push('🔍 建议使用写实类关键词')

    return {
      qualityScore: Math.round(qualityScore * 10) / 10,
      consistencyScore: Math.round(consistencyScore * 10) / 10,
      realismScore: Math.round(realismScore * 10) / 10,
      detailScore: Math.round(detailScore * 10) / 10,
      compositionScore: Math.round(compositionScore * 10) / 10,
      totalScore: Math.round(totalScore * 10) / 10,
      summaries,
    }
  },

  /**
   * 评分缓存（避免重复评估同一 prompt）
   */
  async evaluateWithCache(options: EvalOptions): Promise<EvaluationResult> {
    // 可加 Redis 缓存，暂不实现
    return await this.evaluate(options)
  },
}
