/**
 * v3-metrics.service.ts — P1.7 V3 Schema 三层审计系统
 *
 * ═══════════════════════════════════════════════════════════════
 * P1.7 宪法
 *   1. 只读观测——不修改 Schema 或 Prompt
 *   2. 字段低于阈值的自动告警（不阻断系统）
 *   3. 所有数据写入 narrative_v3_metrics 表
 * ═══════════════════════════════════════════════════════════════
 */

import { prisma } from '../utils/index.js'

// ─── 类型定义 ────────────────────────────────────────────────

export interface V3MetricsInput {
  scriptId: string
  userId: string
  segments: any[]
  compiledPrompt?: string
}

export interface V3MetricsReport {
  scriptId: string
  fillRate: Record<string, number>
  qualityRate: Record<string, number>
  semanticYield: number
  segmentCount: number
  timestamp: Date
}

export interface V3HealthReport {
  period: { from: Date; to: Date }
  scriptCount: number
  avgFillRate: Record<string, number>
  avgQualityRate: Record<string, number>
  avgSemanticYield: number
  alerts: V3Alert[]
}

export interface V3Alert {
  field: string
  layer: 'fill' | 'quality' | 'consumption'
  rate: number
  threshold: number
  message: string
}

// ─── Layer 1: Field Fill Rate ──────────────────────────────────

/**
 * 计算 V3 Segment 数组中各字段的填充率。
 * 字段存在且非空字符串/非空数组/非空对象 → 视为已填充。
 */
function computeFillRate(segments: any[]): Record<string, number> {
  const total = segments.length || 1
  const counts: Record<string, number> = {
    cameraShot: 0,
    cameraMovement: 0,
    cameraAngle: 0,
    cameraLens: 0,
    envLocation: 0,
    envLighting: 0,
    envAtmosphere: 0,
    envColorPalette: 0,
    emotionType: 0,
    emotionIntensity: 0,
    characterPresence: 0,
    action: 0,
    dialogue: 0,
  }

  for (const seg of segments) {
    // camera
    if (seg.camera?.shot && seg.camera.shot !== '') counts.cameraShot++
    if (seg.camera?.movement && seg.camera.movement !== '') counts.cameraMovement++
    if (seg.camera?.angle && seg.camera.angle !== '') counts.cameraAngle++
    if (seg.camera?.lens && seg.camera.lens !== '') counts.cameraLens++

    // environment
    const env = seg.environment || {}
    if (typeof env === 'object') {
      if (env.location && env.location !== '') counts.envLocation++
      if (env.lighting && env.lighting !== '') counts.envLighting++
      if (env.atmosphere && env.atmosphere !== '') counts.envAtmosphere++
      if (env.colorPalette && env.colorPalette !== '') counts.envColorPalette++
    } else if (typeof env === 'string' && env !== '') {
      counts.envLocation++ // 旧格式兼容
    }

    // emotion
    if (seg.emotion?.type && seg.emotion.type !== '') counts.emotionType++
    if (seg.emotion?.intensity !== undefined && seg.emotion.intensity !== null) counts.emotionIntensity++

    // characterPresence
    if (seg.characters && Array.isArray(seg.characters) && seg.characters.length > 0) counts.characterPresence++

    // action / dialogue
    if (seg.action && seg.action !== '') counts.action++
    if (seg.dialogue && seg.dialogue !== '') counts.dialogue++
  }

  const rate: Record<string, number> = {}
  for (const [key, count] of Object.entries(counts)) {
    rate[key] = Math.round((count / total) * 10000) / 100
  }
  return rate
}

// ─── Layer 2: Field Quality Rate ──────────────────────────────

const DEFAULT_VALUES = ['normal', 'eye_level', 'neutral', 'default', 'standard', 'cinematic', 'basic']

/**
 * 计算字段有效值率——排除 LLM 输出的默认/占位值。
 */
function computeQualityRate(segments: any[]): Record<string, number> {
  const total = segments.length || 1

  let angleValid = 0
  let intensityValid = 0
  let paletteValid = 0

  for (const seg of segments) {
    // camera.angle: 排除 "eye_level" / "normal" / "standard" 等默认值
    const angle = seg.camera?.angle
    if (angle && angle !== '' && !DEFAULT_VALUES.includes(angle.toLowerCase().trim())) {
      angleValid++
    }

    // emotion.intensity: 排除 0.5（LLM 默认值）和 1.0（LLM 不思考时给的极端值）
    const intensity = seg.emotion?.intensity
    if (intensity !== undefined && intensity !== null) {
      const n = Number(intensity)
      if (n > 0.1 && n < 1.0 && n !== 0.5) {
        intensityValid++
      }
    }

    // colorPalette: 排除常见默认值
    const palette = seg.environment?.colorPalette
    if (palette && palette !== '' && !DEFAULT_VALUES.some(d => palette.toLowerCase().includes(d))) {
      paletteValid++
    }
  }

  return {
    cameraAngle: Math.round((angleValid / total) * 10000) / 100,
    emotionIntensity: Math.round((intensityValid / total) * 10000) / 100,
    colorPalette: Math.round((paletteValid / total) * 10000) / 100,
  }
}

// ─── Layer 3: Semantic Yield ────────────────────────────────

/**
 * 估算 Semantic Yield——最终 Video Prompt 中来自结构化字段的信息占比。
 *
 * 计算方式：解析最终 prompt 中的结构化标签（[Camera], [Environment], [Emotion] 等）
 * 与非结构化 narrative/text 的 token 比例。
 */
function computeSemanticYield(segments: any[], compiledPrompt?: string): number {
  if (!compiledPrompt) return 0

  const structuredPatterns = [
    /\[Camera\]/g,
    /\[Subject\]/g,
    /\[Action\]/g,
    /\[Environment\]/g,
    /\[VFX\]/g,
    /\[Emotion\]/g,
    /\[Style\]/g,
    /\[Negative\]/g,
  ]

  // 结构化标签的字符长度
  let structuredLength = 0
  let totalLength = compiledPrompt.length

  for (const pattern of structuredPatterns) {
    const matches = compiledPrompt.match(pattern)
    if (matches) {
      structuredLength += matches.length * 10 // 每个标签平均 10 字符的字段值
    }
  }

  // 再加结构化字段 key:value 部分
  const structuredContentMatch = compiledPrompt.match(/\[(Camera|Subject|Action|Environment|VFX|Emotion|Style|Negative)\].*/g)
  if (structuredContentMatch) {
    structuredLength = structuredContentMatch.join('').length
  }

  // 非结构化部分包括没有标签的叙述文字
  const unstructuredLines = compiledPrompt.split('\n').filter(l => !l.startsWith('['))
  const unstructuredLength = unstructuredLines.join('').length

  if (totalLength === 0) return 0

  const yieldRate = Math.round((structuredLength / totalLength) * 10000) / 100
  return Math.min(yieldRate, 100)
}

// ─── 主入口 ──────────────────────────────────────────────────

/**
 * 采集 V3 Metrics 并写入 DB。
 * 接受一个剧本的 V3 segments + 可选的编译后 prompt。
 */
export async function collectV3Metrics(input: V3MetricsInput): Promise<V3MetricsReport> {
  const { scriptId, userId, segments, compiledPrompt } = input

  const fillRate = computeFillRate(segments)
  const qualityRate = computeQualityRate(segments)
  const semanticYield = computeSemanticYield(segments, compiledPrompt)

  // 写入 DB
  await prisma.narrativeV3Metrics.create({
    data: {
      scriptId,
      userId,
      // Layer 1
      fillCameraShot: fillRate.cameraShot,
      fillCameraMovement: fillRate.cameraMovement,
      fillCameraAngle: fillRate.cameraAngle,
      fillCameraLens: fillRate.cameraLens,
      fillEnvLocation: fillRate.envLocation,
      fillEnvLighting: fillRate.envLighting,
      fillEnvAtmosphere: fillRate.envAtmosphere,
      fillEnvColorPalette: fillRate.envColorPalette,
      fillEmotionType: fillRate.emotionType,
      fillEmotionIntensity: fillRate.emotionIntensity,
      fillCharacterPresence: fillRate.characterPresence,
      fillAction: fillRate.action,
      fillDialogue: fillRate.dialogue,
      // Layer 2
      qualityCameraAngle: qualityRate.cameraAngle,
      qualityEmotionIntensity: qualityRate.emotionIntensity,
      qualityColorPalette: qualityRate.colorPalette,
      // Layer 3
      semanticYield,
      segmentCount: segments.length,
      rawStats: { fillRate, qualityRate, semanticYield },
    },
  })

  return {
    scriptId,
    fillRate,
    qualityRate,
    semanticYield,
    segmentCount: segments.length,
    timestamp: new Date(),
  }
}

// ─── 健康报告生成 ──────────────────────────────────────────

const FILL_THRESHOLD = 90
const QUALITY_THRESHOLD = 70
const YIELD_THRESHOLD = 70

/**
 * 生成 V3 Schema Health Report。
 * 默认查询最近 24 小时的数据。
 */
export async function generateV3HealthReport(hours: number = 24): Promise<V3HealthReport> {
  const from = new Date(Date.now() - hours * 3600_000)
  const to = new Date()

  const records = await prisma.narrativeV3Metrics.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
  })

  const count = records.length
  if (count === 0) {
    return {
      period: { from, to },
      scriptCount: 0,
      avgFillRate: {},
      avgQualityRate: {},
      avgSemanticYield: 0,
      alerts: [],
    }
  }

  // 计算平均填充率
  const sumFill = (field: keyof typeof records[0]) =>
    records.reduce((s, r) => s + Number(r[field] || 0), 0) / count

  const avgFillRate: Record<string, number> = {
    cameraShot: Math.round(sumFill('fillCameraShot') * 100) / 100,
    cameraMovement: Math.round(sumFill('fillCameraMovement') * 100) / 100,
    cameraAngle: Math.round(sumFill('fillCameraAngle') * 100) / 100,
    cameraLens: Math.round(sumFill('fillCameraLens') * 100) / 100,
    envLocation: Math.round(sumFill('fillEnvLocation') * 100) / 100,
    envLighting: Math.round(sumFill('fillEnvLighting') * 100) / 100,
    envAtmosphere: Math.round(sumFill('fillEnvAtmosphere') * 100) / 100,
    envColorPalette: Math.round(sumFill('fillEnvColorPalette') * 100) / 100,
    emotionType: Math.round(sumFill('fillEmotionType') * 100) / 100,
    emotionIntensity: Math.round(sumFill('fillEmotionIntensity') * 100) / 100,
    characterPresence: Math.round(sumFill('fillCharacterPresence') * 100) / 100,
    action: Math.round(sumFill('fillAction') * 100) / 100,
    dialogue: Math.round(sumFill('fillDialogue') * 100) / 100,
  }

  const avgQualityRate: Record<string, number> = {
    cameraAngle: Math.round(sumFill('qualityCameraAngle') * 100) / 100,
    emotionIntensity: Math.round(sumFill('qualityEmotionIntensity') * 100) / 100,
    colorPalette: Math.round(sumFill('qualityColorPalette') * 100) / 100,
  }

  const avgSemanticYield = Math.round(
    records.reduce((s, r) => s + Number(r.semanticYield || 0), 0) / count * 100
  ) / 100

  // 生成告警
  const alerts: V3Alert[] = []

  for (const [field, rate] of Object.entries(avgFillRate)) {
    if (rate < FILL_THRESHOLD) {
      alerts.push({
        field,
        layer: 'fill',
        rate,
        threshold: FILL_THRESHOLD,
        message: `⚠️ ${field} 填充率 ${rate}% < ${FILL_THRESHOLD}%`,
      })
    }
  }

  for (const [field, rate] of Object.entries(avgQualityRate)) {
    if (rate < QUALITY_THRESHOLD) {
      alerts.push({
        field,
        layer: 'quality',
        rate,
        threshold: QUALITY_THRESHOLD,
        message: `⚠️ ${field} 有效值率 ${rate}% < ${QUALITY_THRESHOLD}%`,
      })
    }
  }

  if (avgSemanticYield < YIELD_THRESHOLD) {
    alerts.push({
      field: 'semanticYield',
      layer: 'consumption',
      rate: avgSemanticYield,
      threshold: YIELD_THRESHOLD,
      message: `⚠️ Semantic Yield ${avgSemanticYield}% < ${YIELD_THRESHOLD}% — 消费链可能存在断层`,
    })
  }

  return {
    period: { from, to },
    scriptCount: count,
    avgFillRate,
    avgQualityRate,
    avgSemanticYield,
    alerts,
  }
}

/**
 * 获取告警信息——供心跳/定时任务调用。
 */
export async function checkV3Alerts(hours: number = 24): Promise<V3Alert[]> {
  const report = await generateV3HealthReport(hours)
  return report.alerts
}
