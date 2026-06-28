/**
 * Character Identity Graph
 * Character Persistence System — 角色一致性系统
 *
 * 角色身份图：跨镜头保持角色身份一致性的核心数据模型。
 *
 * 每一层 identity 约束由抽象到具体：
 *   - facialEmbedding: 面部向量（占位，需接入真实 embedding 模型）
 *   - bodySignature: 体态特征（身高、体型、姿态倾向）
 *   - outfitSchema: 着装规范（基础服装、配色、配饰）
 *   - voiceStyle: 声音风格（科幻AI角色未来可扩展）
 *
 * 设计原则：
 *   - 三层约束可独立运作（即使没有 embedding 模型也能保证体态+着装一致）
 *   - 所有值有合理缺省值，零配置可用
 *   - 面向视频 prompt 注入，而非图像生成
 */

export interface CharacterIdentity {
  /** 角色唯一 ID */
  id: string
  /** 角色名称 */
  name: string

  /** 面部特征（占位：接入 embedding 模型后填入向量） */
  facialSignature: {
    /** 种族描述（prompt 友好文本） */
    ethnicity: string
    /** 年龄 */
    age: string
    /** 面部特征关键词 */
    features: string[]
    /** 头像风格关键词 */
    portraitStyle: string
    /** 面部嵌入向量（预留，当前为占位） */
    embeddingPlaceholder: `${string}-${string}`
  }

  /** 体态特征 */
  bodySignature: {
    /** 身高 */
    height: 'tall' | 'average' | 'short'
    /** 体型 */
    build: 'athletic' | 'slim' | 'average' | 'muscular' | 'heavy'
    /** 姿态倾向 */
    postureBias: 'upright' | 'stooped' | 'dynamic' | 'relaxed'
    /** 标志性体态描述 */
    signatureMannerism: string
  }

  /** 着装规范 */
  outfitSchema: {
    /** 基础服装描述 */
    baseClothing: string
    /** 配色方案 */
    colorPalette: string[]
    /** 配饰 */
    accessories: string[]
    /** 服装风格 */
    style: 'casual' | 'formal' | 'military' | 'traditional' | 'fantasy' | 'futuristic' | 'vintage' | 'sportswear'
  }

  /** 声音风格（预留） */
  voiceStyle?: {
    tone: 'deep' | 'soft' | 'bright' | 'raspy'
    accent: string
  }
}

// ─── 工具函数 ───

/**
 * 从角色身份生成持续注入的 identity lock prompt 片段
 */
export function characterIdentityToPromptSegment(identity: CharacterIdentity): string {
  const parts: string[] = []

  // 体态
  parts.push(`character: ${identity.name}, ${identity.bodySignature.height}, ${identity.bodySignature.build}, ${identity.bodySignature.postureBias} posture`)

  // 面部
  parts.push(`face: ${identity.facialSignature.ethnicity}, ${identity.facialSignature.age}, ${identity.facialSignature.features.join(', ')}, ${identity.facialSignature.portraitStyle}`)

  // 着装
  const colors = identity.outfitSchema.colorPalette.join('/')
  parts.push(`outfit: ${identity.outfitSchema.baseClothing}, ${colors} color scheme, ${identity.outfitSchema.style} style`)

  // 配饰
  if (identity.outfitSchema.accessories.length > 0) {
    parts.push(`accessories: ${identity.outfitSchema.accessories.join(', ')}`)
  }

  // 体态习惯
  parts.push(`mannerism: ${identity.bodySignature.signatureMannerism}`)

  return `[identity_lock: ${identity.id}]\n${parts.join('\n')}`
}

/**
 * 创建缺省角色身份（用于快速测试）
 */
export function createDefaultCharacter(name: string, id: string): CharacterIdentity {
  return {
    id,
    name,
    facialSignature: {
      ethnicity: 'East Asian',
      age: 'young adult',
      features: ['sharp eyes', 'defined jawline', 'clear skin'],
      portraitStyle: 'natural expression',
      embeddingPlaceholder: `placeholder-${id}-${Date.now()}`,
    },
    bodySignature: {
      height: 'average',
      build: 'average',
      postureBias: 'upright',
      signatureMannerism: 'stands confidently',
    },
    outfitSchema: {
      baseClothing: 'casual modern outfit',
      colorPalette: ['navy', 'white'],
      accessories: [],
      style: 'casual',
    },
    voiceStyle: {
      tone: 'bright',
      accent: 'standard Mandarin',
    },
  }
}
