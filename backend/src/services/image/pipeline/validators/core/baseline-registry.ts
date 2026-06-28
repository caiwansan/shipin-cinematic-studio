// ============================================================
// core/baseline-registry.ts
//
// 职责：D1.2 Global Quality Ontology
//   统一跨 domain 的质量评分体系统计
//   character、scene、storyboard、frame、video 共用同一定义锚点
//
// 设计原则：
//   - 每个 domain 有自己独立的维度集
//   - 维度之间通过 DimensionMatrix 定义语义映射
//   - 所有 domain 的校准分数是跨域可比的（同一把尺子）
//   - baseline 是静态 versioned 的，不随运行时变化
// ============================================================

// ─── 基线条目 ──────────────────────────────────────────

export interface BaselineAnchor<T = unknown> {
  name: string
  expectedScore: number
  tolerance: number
  description: string
  meta?: T
}

// ─── Domain 类型 ───────────────────────────────────────

export type QualityDomain = 'character' | 'scene' | 'storyboard' | 'frame' | 'video'

// ─── 维度类型 ──────────────────────────────────────────

/**
 * Character domain 验证维度
 */
export type CharacterDimension =
  | 'faceIntegrity'
  | 'viewConsistency'
  | 'identityStability'
  | 'promptFaithfulness'
  | 'backgroundClean'

/**
 * Scene domain 验证维度
 */
export type SceneDimension =
  | 'composition'
  | 'characterAppearance'
  | 'lightingConsistency'
  | 'backgroundRelevance'
  | 'spatialCoherence'

/**
 * Storyboard domain 验证维度
 */
export type StoryboardDimension =
  | 'narrativeFlow'
  | 'shotConsistency'
  | 'actionClarity'
  | 'frameComposition'
  | 'transitionQuality'

/**
 * Frame / Video domain 验证维度
 */
export type FrameDimension =
  | 'temporalStability'
  | 'motionBlur'
  | 'colorGrading'
  | 'resolutionQuality'
  | 'artifactFree'

// ─── Baseline 定义 ─────────────────────────────────────

type AnchorMap<T extends string> = { [K in T]: BaselineAnchor[] }

export interface OntologyBaseline<D extends string = string> {
  domain: QualityDomain
  version: string
  dimensions: AnchorMap<D>
  createdAt: string
}

// ─── Character Baseline V1 ─────────────────────────────

const CHARACTER_BASELINE_V1: OntologyBaseline<CharacterDimension> = {
  domain: 'character',
  version: '1.0.0',
  dimensions: {
    faceIntegrity: [
      { name: '优秀正面免冠脸', expectedScore: 0.95, tolerance: 0.05, description: '五官清晰完整、比例正常、光照均匀、无畸变、无崩坏' },
      { name: '合格正面脸', expectedScore: 0.70, tolerance: 0.10, description: '五官可辨认、无严重畸变、可识别角色身份' },
      { name: '崩坏脸（应拒绝）', expectedScore: 0.15, tolerance: 0.15, description: '五官比例严重失调、面部扭曲、多眼多鼻、弥散模糊' },
    ],
    viewConsistency: [
      { name: '四视图角色一致', expectedScore: 0.85, tolerance: 0.10, description: '正/侧/背四张图中人脸特征、体型、服装颜色整体一致' },
      { name: '视图中等偏差', expectedScore: 0.50, tolerance: 0.15, description: '部分视图间发型或颜色有偏移，但能认出是同一角色' },
    ],
    identityStability: [
      { name: '跨视图身份稳定', expectedScore: 0.90, tolerance: 0.08, description: '不同视图/表情/光照下角色身份特征不变' },
      { name: '身份轻微漂移', expectedScore: 0.55, tolerance: 0.10, description: '部分视图间角色看起来"不太像同一个人"' },
    ],
    promptFaithfulness: [
      { name: '完全遵循prompt', expectedScore: 0.95, tolerance: 0.05, description: '姿势、服装、场景、元素全部符合prompt描述' },
      { name: '部分偏离prompt', expectedScore: 0.55, tolerance: 0.15, description: '主要元素符合但细节有偏差（姿势/角度不对）' },
    ],
    backgroundClean: [
      { name: '纯白背景', expectedScore: 0.95, tolerance: 0.05, description: '背景纯白均匀，无明显阴影/纹理/杂物' },
      { name: '轻微背景污染', expectedScore: 0.55, tolerance: 0.15, description: '背景有轻微阴影或渐变但人物不受影响' },
      { name: '背景严重污染', expectedScore: 0.15, tolerance: 0.15, description: '背景复杂、多人、杂物干扰角色主体表现' },
    ],
  },
  createdAt: '2026-06-23T05:20:00Z',
}

// ─── Scene Baseline V1 ─────────────────────────────────

const SCENE_BASELINE_V1: OntologyBaseline<SceneDimension> = {
  domain: 'scene',
  version: '1.0.0',
  dimensions: {
    composition: [
      { name: '优秀场景构图', expectedScore: 0.95, tolerance: 0.05, description: '画面布局专业、焦点明确、视觉平衡、电影感强' },
      { name: '合格场景构图', expectedScore: 0.70, tolerance: 0.10, description: '画面元素可辨识、主体清晰、构图无重大缺陷' },
      { name: '构图混乱', expectedScore: 0.20, tolerance: 0.15, description: '画面元素杂乱、主体不突出、视觉焦点分裂' },
    ],
    characterAppearance: [
      { name: '角色形象匹配', expectedScore: 0.90, tolerance: 0.08, description: '场景中角色外观与角色设计图一致（服装、体型、面貌）' },
      { name: '角色轻微偏差', expectedScore: 0.60, tolerance: 0.12, description: '角色主要特征可辨认但细节有出入（服装颜色/配饰偏差）' },
      { name: '角色完全不符', expectedScore: 0.15, tolerance: 0.15, description: '场景中角色形象与设定完全不匹配' },
    ],
    lightingConsistency: [
      { name: '光影一致', expectedScore: 0.90, tolerance: 0.08, description: '场景内所有元素的光照方向、色温、阴影逻辑一致' },
      { name: '光影轻微矛盾', expectedScore: 0.55, tolerance: 0.12, description: '整体光照氛围符合但局部有阴影方向矛盾' },
    ],
    backgroundRelevance: [
      { name: '背景高度匹配', expectedScore: 0.90, tolerance: 0.08, description: '背景环境与剧本场景描述完全吻合（时代/地点/氛围）' },
      { name: '背景基本匹配', expectedScore: 0.65, tolerance: 0.12, description: '背景大致符合场景描述但缺乏细节或略有偏差' },
    ],
    spatialCoherence: [
      { name: '空间关系正确', expectedScore: 0.90, tolerance: 0.08, description: '前景/背景、远近关系、物体比例符合物理逻辑' },
      { name: '空间关系混乱', expectedScore: 0.25, tolerance: 0.15, description: '物体比例失调、远近关系矛盾、透视扭曲' },
    ],
  },
  createdAt: '2026-06-23T05:25:00Z',
}

// ─── Storyboard Baseline V1 ────────────────────────────

const STORYBOARD_BASELINE_V1: OntologyBaseline<StoryboardDimension> = {
  domain: 'storyboard',
  version: '1.0.0',
  dimensions: {
    narrativeFlow: [
      { name: '叙事流畅', expectedScore: 0.90, tolerance: 0.08, description: '相邻帧之间故事线连贯、镜头语言逻辑清晰' },
      { name: '叙事中等', expectedScore: 0.60, tolerance: 0.12, description: '整体故事可理解但少量镜头跳跃影响阅读' },
      { name: '叙事断裂', expectedScore: 0.20, tolerance: 0.15, description: '帧之间叙事不连贯、观众无法理解故事进程' },
    ],
    shotConsistency: [
      { name: '镜头语言统一', expectedScore: 0.85, tolerance: 0.10, description: '镜头景别、角度、运动方式在合理范围内变化' },
      { name: '镜头切换突兀', expectedScore: 0.40, tolerance: 0.15, description: '景别或角度跳跃过大，视觉上造成不适' },
    ],
    actionClarity: [
      { name: '动作表达清晰', expectedScore: 0.90, tolerance: 0.08, description: '角色动作意图明确、关键动作帧定位准确' },
      { name: '动作模糊', expectedScore: 0.40, tolerance: 0.15, description: '角色姿势或动作不明确、无法判断正在做什么' },
    ],
    frameComposition: [
      { name: '帧构图专业', expectedScore: 0.85, tolerance: 0.10, description: '单帧画面符合电影构图规则（三分法/引导线/留白）' },
      { name: '帧构图一般', expectedScore: 0.55, tolerance: 0.12, description: '构图无大错但缺乏表现力' },
    ],
    transitionQuality: [
      { name: '转场自然', expectedScore: 0.85, tolerance: 0.10, description: '帧间转场方式与叙事节奏匹配、无生硬跳切' },
      { name: '转场生硬', expectedScore: 0.35, tolerance: 0.15, description: '转场缺乏逻辑、视觉上跳跃感强' },
    ],
  },
  createdAt: '2026-06-23T05:30:00Z',
}

// ─── Frame / Video Baseline V1 ─────────────────────────

const VIDEO_BASELINE_V1: OntologyBaseline<FrameDimension> = {
  domain: 'video',
  version: '1.0.0',
  dimensions: {
    temporalStability: [
      { name: '时序稳定', expectedScore: 0.90, tolerance: 0.08, description: '连续帧之间画面稳定、无闪烁/抖动/瞬变' },
      { name: '轻微闪烁', expectedScore: 0.50, tolerance: 0.15, description: '部分帧存在亮度或颜色闪烁' },
      { name: '严重不稳定', expectedScore: 0.15, tolerance: 0.12, description: '画面剧烈抖动/闪烁/跳帧' },
    ],
    motionBlur: [
      { name: '运动模糊自然', expectedScore: 0.85, tolerance: 0.10, description: '运动物体的模糊程度符合物理规律、观感自然' },
      { name: '运动模糊异常', expectedScore: 0.35, tolerance: 0.15, description: '运动模糊过度或不足、产生视觉不适' },
    ],
    colorGrading: [
      { name: '调色专业', expectedScore: 0.85, tolerance: 0.10, description: '色调一致、风格明确、情绪表达符合剧情需要' },
      { name: '调色可接受', expectedScore: 0.55, tolerance: 0.15, description: '色调无明显异常但缺乏风格一致性' },
      { name: '调色问题', expectedScore: 0.20, tolerance: 0.15, description: '色调漂移、色偏严重、不同片段色彩断裂' },
    ],
    resolutionQuality: [
      { name: '分辨率达标', expectedScore: 0.90, tolerance: 0.08, description: '清晰度满足输出要求、无明显噪点/压缩伪影' },
      { name: '清晰度偏低', expectedScore: 0.45, tolerance: 0.15, description: '画面模糊或压缩痕迹明显' },
    ],
    artifactFree: [
      { name: '无伪影', expectedScore: 0.95, tolerance: 0.05, description: '画面干净、无断裂/扭曲/AI鬼影/物体变形' },
      { name: '轻微伪影', expectedScore: 0.50, tolerance: 0.15, description: '少量AI生成痕迹但不影响主体表现' },
      { name: '严重伪影', expectedScore: 0.10, tolerance: 0.10, description: '画面大面积扭曲/断裂/物体变形' },
    ],
  },
  createdAt: '2026-06-23T05:35:00Z',
}

// ─── 跨域维度映射矩阵 ──────────────────────────────────

/**
 * 维度映射：跨 domain 的语义等价关系
 *
 * 用于：
 *   1. 跨域质量报告合并（character+scene → 单帧综合质量）
 *   2. 维度权重的跨域传递（identity 权重从 character 自然传递到 scene）
 *   3. 异常溯源（scene 的 characterAppearance 低 → 检查 character 的 identityStability）
 *
 * key 格式：`<source_domain>:<source_dimension>`
 * value：映射到的目标 domain+维度及映射权重
 */
export interface DimensionMapping {
  targetDomain: QualityDomain
  targetDimension: string
  /** 语义相关性（0-1），1=完全等价，0.5=弱相关 */
  semanticWeight: number
}

export const DIMENSION_MATRIX: Record<string, DimensionMapping[]> = {
  // character → scene: 角色一致性自然延伸到场景
  'character:identityStability': [
    { targetDomain: 'scene', targetDimension: 'characterAppearance', semanticWeight: 0.85 },
    { targetDomain: 'storyboard', targetDimension: 'actionClarity', semanticWeight: 0.50 },
  ],
  'character:faceIntegrity': [
    { targetDomain: 'scene', targetDimension: 'characterAppearance', semanticWeight: 0.70 },
  ],
  // scene → storyboard: 场景质量影响分镜质量
  'scene:composition': [
    { targetDomain: 'storyboard', targetDimension: 'frameComposition', semanticWeight: 0.80 },
  ],
  'scene:spatialCoherence': [
    { targetDomain: 'storyboard', targetDimension: 'shotConsistency', semanticWeight: 0.65 },
  ],
  // storyboard → video: 分镜质量决定视频基础
  'storyboard:narrativeFlow': [
    { targetDomain: 'video', targetDimension: 'temporalStability', semanticWeight: 0.60 },
  ],
  'storyboard:transitionQuality': [
    { targetDomain: 'video', targetDimension: 'motionBlur', semanticWeight: 0.50 },
  ],
}

// ─── 注册中心 ──────────────────────────────────────────

type VersionedKey = `${QualityDomain}:${string}`

const BASELINE_REGISTRY: Record<VersionedKey, OntologyBaseline> = {
  'character:1.0.0': CHARACTER_BASELINE_V1,
  'scene:1.0.0': SCENE_BASELINE_V1,
  'storyboard:1.0.0': STORYBOARD_BASELINE_V1,
  'video:1.0.0': VIDEO_BASELINE_V1,
}

// ─── API ───────────────────────────────────────────────

export function getBaseline<D extends QualityDomain>(
  domain: D,
  version = '1.0.0',
): OntologyBaseline | null {
  const key: VersionedKey = `${domain}:${version}`
  return BASELINE_REGISTRY[key] ?? null
}

export function getAnchors<D extends QualityDomain>(
  domain: D,
  dimension: string,
  version = '1.0.0',
): BaselineAnchor[] {
  const baseline = getBaseline(domain, version)
  if (!baseline) return []
  const dims = baseline.dimensions as Record<string, BaselineAnchor[]>
  return dims[dimension] ?? []
}

export function getAllDomains(): OntologyBaseline[] {
  return Object.values(BASELINE_REGISTRY)
}

/**
 * baseline 距离计算
 */
export function baselineDistance(
  rawScore: number,
  anchors: BaselineAnchor[],
): { calibrated: number; closestAnchor: BaselineAnchor | null; distance: number } {
  if (anchors.length === 0) {
    return { calibrated: rawScore, closestAnchor: null, distance: 0 }
  }

  let minDist = Infinity
  let closest: BaselineAnchor | null = null

  for (const anchor of anchors) {
    const dist = Math.abs(rawScore - anchor.expectedScore) / anchor.tolerance
    if (dist < minDist) {
      minDist = dist
      closest = anchor
    }
  }

  const distance = Math.min(minDist, 1)

  let calibrated: number
  if (closest && minDist <= 1) {
    calibrated = closest.expectedScore
  } else if (closest) {
    const direction = rawScore > closest.expectedScore ? 1 : -1
    const decay = Math.max(0, 1 - (minDist - 1))
    calibrated = closest.expectedScore + direction * closest.tolerance * decay
  } else {
    calibrated = rawScore
  }

  return {
    calibrated: Math.max(0, Math.min(1, calibrated)),
    closestAnchor: closest,
    distance,
  }
}

/**
 * 跨域维度映射查询
 *
 * 例：给定 character:identityStability，返回所有关联的 domain 维度
 */
export function resolveDimensionMapping(
  sourceDomain: QualityDomain,
  sourceDimension: string,
): DimensionMapping[] {
  const key = `${sourceDomain}:${sourceDimension}`
  return DIMENSION_MATRIX[key] ?? []
}

/**
 * 反向映射：给定目标 domain+维度，返回所有影响它的上游
 */
export function resolveUpstreamMapping(
  targetDomain: QualityDomain,
  targetDimension: string,
): { sourceDomain: QualityDomain; sourceDimension: string; semanticWeight: number }[] {
  const results: { sourceDomain: QualityDomain; sourceDimension: string; semanticWeight: number }[] = []
  for (const [key, mappings] of Object.entries(DIMENSION_MATRIX)) {
    const match = mappings.find(m => m.targetDomain === targetDomain && m.targetDimension === targetDimension)
    if (match) {
      const [srcDomain, srcDim] = key.split(':') as [QualityDomain, string]
      results.push({ sourceDomain: srcDomain, sourceDimension: srcDim, semanticWeight: match.semanticWeight })
    }
  }
  return results
}
