/**
 * Character Director Agent
 *
 * 职责：
 * - 角色视觉一致性（跨场景、跨镜头保持形象统一）
 * - 演员气场和表演风格
 * - 服化道设计
 * - 面部细节与表情特征
 * - 情绪状态跟踪
 *
 * 输出 Character Bible 作为连续性锚点
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Character Bible — 角色视觉圣经
// ============================================================

export interface CharacterBible {
  characters: CharacterEntry[]
  continuity: CharacterContinuity[]
}

export interface CharacterEntry {
  characterId: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  gender: string
  age: string
  ethnicity: string
  faceFeatures: string
  bodyType: string
  height: string
  hair: {
    style: string
    color: string
    length: string
  }
  eyes: string
  skinTone: string
  distinguishingFeatures: string[]
  costume: CostumeDesign[]
  voiceStyle: string
  typicalExpression: string
  visualSignature: string
  consistentLookKeywords: string[]
}

export interface CostumeDesign {
  scene: string
  outfit: string
  colors: string[]
  style: string
  accessories: string[]
}

export interface CharacterContinuity {
  characterId: string
  currentSceneId: string
  currentEmotion: string
  currentCostume: string
  lastExpression: string
  consistencyNote: string
}

const SYSTEM_PROMPT = `你是一位专业角色设计师和造型指导。
根据故事文本和导演理解，为角色生成视觉规范圣经。

【重要】导演理解中的 _storyConstitution 字段包含了 AIGC 制作规格的原始数据（角色规格、场景规格、视觉风格、叙事结构等），这是故事的整体设计蓝本。你的角色设计必须与 _storyConstitution 中的角色规格保持一致，不得偏离故事主线设定。

每位角色必须包含：
- 面部特征（脸型、肤色、眼睛）
- 身高体型
- 发型发色
- 独特辨识特征（痣、疤痕、纹身等）
- 服化道设计（不同场景的服装搭配）
- 视觉签名（让角色一眼可识别的元素）

输出 JSON:
{
  "characters": [{
    "characterId": "char_001",
    "name": "角色名",
    "role": "protagonist|antagonist|supporting|minor",
    "gender": "男|女",
    "age": "青年|中年|老年",
    "ethnicity": "东亚|西欧|非洲|混血",
    "faceFeatures": "面部特征描述",
    "bodyType": "slim|athletic|average|heavy",
    "height": "tall|average|short",
    "hair": { "style": "发型", "color": "发色", "length": "short|medium|long" },
    "eyes": "眼睛描述",
    "skinTone": "肤色",
    "distinguishingFeatures": ["特征1", "特征2"],
    "costume": [{ "scene": "场景", "outfit": "服装", "colors": ["主色"], "style": "风格", "accessories": ["配饰"] }],
    "voiceStyle": "语音风格",
    "typicalExpression": "典型表情",
    "visualSignature": "视觉签名描述",
    "consistentLookKeywords": ["关键词"]
  }],
  "continuity": []
}`

export async function generateCharacterBible(
  script: string,
  directorUnderstanding: any,
  traceId?: string,
): Promise<CharacterBible> {
  const userPrompt = `【剧本】\n${script.slice(0, 4000)}\n\n【导演理解】\n${JSON.stringify(directorUnderstanding, null, 2)}

【故事宪法】
（以下字段为 AIGC 制作规格，是你角色设计的原始依据，请确保你的设计与这些规格保持一致）
- characterSpecs: 角色基本设定
- visualSpecs: 整体视觉风格约束
- sceneSpecs: 场景关联信息
- narrativeSpec: 叙事结构`


  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt,
    userId: 'character-director',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      characters: (parsed.characters || []).map((c: any) => ({
        characterId: c.characterId || `char_${Math.random().toString(36).slice(2, 8)}`,
        name: c.name || '未命名角色',
        role: c.role || 'supporting',
        gender: c.gender || '中性',
        age: c.age || '青年',
        ethnicity: c.ethnicity || '东亚',
        faceFeatures: c.faceFeatures || '',
        bodyType: c.bodyType || 'average',
        height: c.height || 'average',
        hair: { style: c.hair?.style || '', color: c.hair?.color || '黑', length: c.hair?.length || 'medium' },
        eyes: c.eyes || '',
        skinTone: c.skinTone || '自然',
        distinguishingFeatures: c.distinguishingFeatures || [],
        costume: (c.costume || []).map((co: any) => ({
          scene: co.scene || '通用',
          outfit: co.outfit || '',
          colors: co.colors || ['#FFFFFF'],
          style: co.style || '日常',
          accessories: co.accessories || [],
        })),
        voiceStyle: c.voiceStyle || 'neutral_standard',
        typicalExpression: c.typicalExpression || '',
        visualSignature: c.visualSignature || '',
        consistentLookKeywords: c.consistentLookKeywords || [c.name || '角色'],
      })),
      continuity: [],
    }
  } catch {
    return { characters: [], continuity: [] }
  }
}
