// ═══════════════════════════════════════════════════════════════
// Model Capability Map — Backend Adapter 能力描述
// ═══════════════════════════════════════════════════════════════
// 不同视频模型的能力不同。Compiler 根据 Capability Map 自动降级。
// ═══════════════════════════════════════════════════════════════

// ─── 模型能力描述 ───────────────────────────────────

export interface ModelCapability {
  id: string
  name: string
  // 镜头控制
  camera: {
    orbit: boolean          // 环绕运镜
    tracking: boolean       // 横移跟拍
    lowAngle: boolean       // 仰拍
    birdEye: boolean        // 俯拍
    handheld: boolean       // 手持抖动
    dollyZoom: boolean      // 推拉变焦
    slowMotion: boolean     // 慢镜头
  }
  // 动作连续性
  motion: {
    temporalConsistency: 1 | 2 | 3 | 4 | 5  // 时间一致性（5=最强）
    multiActionSequence: boolean               // 多动作序列
    physicsWeight: 1 | 2 | 3                  // 物理感知（3=最强）
    animeMotion: boolean                       // 动漫风格动作
  }
  // 特效
  vfx: {
    sparks: boolean
    glow: boolean
    shockwave: boolean
    energyTrail: boolean
    smoke: boolean
    waterSplash: boolean
    motionBlur: boolean
  }
  // 角色控制
  character: {
    expressionTransition: boolean  // 表情过渡
    multiCharacter: boolean        // 多角色同框
  }
  // 输入限制
  limits: {
    maxPromptTokens: number        // 最大 prompt 字符数
    maxDuration: number            // 最大视频时长（秒）
    supportedAspectRatios: string[] // 支持的宽高比
  }
}

// ─── 能力等级评分 ──────────────────────────────────

export interface ModelCapabilityScore {
  modelId: string
  cameraScore: number       // 0-100
  motionScore: number       // 0-100
  vfxScore: number          // 0-100
  characterScore: number    // 0-100
  overall: number           // 加权总分
}

function scoreCamera(cap: ModelCapability): number {
  const weights = { orbit: 20, tracking: 15, lowAngle: 10, birdEye: 10, handheld: 15, dollyZoom: 10, slowMotion: 20 }
  let score = 0
  if (cap.camera.orbit) score += weights.orbit
  if (cap.camera.tracking) score += weights.tracking
  if (cap.camera.lowAngle) score += weights.lowAngle
  if (cap.camera.birdEye) score += weights.birdEye
  if (cap.camera.handheld) score += weights.handheld
  if (cap.camera.dollyZoom) score += weights.dollyZoom
  if (cap.camera.slowMotion) score += weights.slowMotion
  return score
}

function scoreMotion(cap: ModelCapability): number {
  const consistencyScore = cap.motion.temporalConsistency * 12
  const sequenceScore = cap.motion.multiActionSequence ? 20 : 0
  const physicsScore = cap.motion.physicsWeight * 8
  const animeScore = cap.motion.animeMotion ? 10 : 0
  return Math.min(100, consistencyScore + sequenceScore + physicsScore + animeScore)
}

function scoreVFX(cap: ModelCapability): number {
  let score = 0
  if (cap.vfx.sparks) score += 15
  if (cap.vfx.glow) score += 15
  if (cap.vfx.shockwave) score += 20
  if (cap.vfx.energyTrail) score += 15
  if (cap.vfx.smoke) score += 10
  if (cap.vfx.waterSplash) score += 15
  if (cap.vfx.motionBlur) score += 10
  return score
}

function scoreCharacter(cap: ModelCapability): number {
  let score = 0
  if (cap.character.expressionTransition) score += 50
  if (cap.character.multiCharacter) score += 50
  return score
}

export function calculateCapabilityScore(cap: ModelCapability): ModelCapabilityScore {
  const cameraScore = scoreCamera(cap)
  const motionScore = scoreMotion(cap)
  const vfxScore = scoreVFX(cap)
  const characterScore = scoreCharacter(cap)

  return {
    modelId: cap.id,
    cameraScore,
    motionScore,
    vfxScore,
    characterScore,
    overall: Math.round(cameraScore * 0.3 + motionScore * 0.35 + vfxScore * 0.2 + characterScore * 0.15),
  }
}

// ─── 具体模型能力定义 ──────────────────────────────

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'bailian-wan2.7': {
    id: 'bailian-wan2.7',
    name: '百炼 WAN2.7',
    camera: {
      orbit: false,
      tracking: true,
      lowAngle: true,
      birdEye: false,
      handheld: false,
      dollyZoom: false,
      slowMotion: true,
    },
    motion: {
      temporalConsistency: 3,
      multiActionSequence: true,
      physicsWeight: 2,
      animeMotion: true,
    },
    vfx: {
      sparks: true,
      glow: true,
      shockwave: false,
      energyTrail: true,
      smoke: true,
      waterSplash: true,
      motionBlur: true,
    },
    character: {
      expressionTransition: false,
      multiCharacter: true,
    },
    limits: {
      maxPromptTokens: 500,
      maxDuration: 10,
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
    },
  },

  // 预留
  'kling': {
    id: 'kling',
    name: 'Kling',
    camera: {
      orbit: false, tracking: true, lowAngle: false, birdEye: false,
      handheld: false, dollyZoom: false, slowMotion: true,
    },
    motion: {
      temporalConsistency: 2, multiActionSequence: true, physicsWeight: 2, animeMotion: false,
    },
    vfx: { sparks: true, glow: false, shockwave: false, energyTrail: false, smoke: true, waterSplash: false, motionBlur: true },
    character: { expressionTransition: false, multiCharacter: true },
    limits: { maxPromptTokens: 300, maxDuration: 5, supportedAspectRatios: ['16:9', '9:16'] },
  },

  'veo': {
    id: 'veo',
    name: 'Veo (Google)',
    camera: {
      orbit: true, tracking: true, lowAngle: true, birdEye: true,
      handheld: true, dollyZoom: true, slowMotion: true,
    },
    motion: {
      temporalConsistency: 5, multiActionSequence: true, physicsWeight: 3, animeMotion: false,
    },
    vfx: { sparks: true, glow: true, shockwave: true, energyTrail: true, smoke: true, waterSplash: true, motionBlur: true },
    character: { expressionTransition: true, multiCharacter: true },
    limits: { maxPromptTokens: 1000, maxDuration: 60, supportedAspectRatios: ['16:9', '9:16', '1:1', '21:9'] },
  },
}

export function getModelCapability(modelId: string): ModelCapability | null {
  return MODEL_CAPABILITIES[modelId] || null
}

export function getCapabilityScore(modelId: string): ModelCapabilityScore | null {
  const cap = getModelCapability(modelId)
  if (!cap) return null
  return calculateCapabilityScore(cap)
}
