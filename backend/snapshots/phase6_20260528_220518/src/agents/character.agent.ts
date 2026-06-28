/**
 * agent_character — 角色提取 Agent
 *
 * 职责：从剧本中提取角色信息（名字、年龄、性别、外貌、性格、服装）
 * 输入：{ script: string }
 * 输出：{ characters: CharacterProfile[] }
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

interface CharacterProfile {
  characterId: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  appearance: {
    gender: string
    age: string
    faceFeatures: string
    hair: { style: string; color: string; length: string }
    eyes: string
    skinTone: string
    bodyType: string
    distinguishingFeatures: string[]
  }
  identityLock: {
    faceSignature: string
    bodySignature: string
    motionSignature: string
    visualAnchorTokens: string[]
  }
  personality: string[]
  plotContext: string          // 该角色相关的剧情上下文
}

const SYSTEM_PROMPT = `你是一位专业的剧本角色分析师。请从以下剧本中提取所有角色信息。

对于每个角色，返回 JSON 格式：
{
  "characters": [
    {
      "characterId": "唯一标识",
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "appearance": {
        "gender": "性别",
        "age": "具体年龄（如"七岁"）",
        "faceFeatures": "面部特征描述",
        "hair": { "style": "发型", "color": "发色", "length": "长度" },
        "eyes": "眼睛描述",
        "skinTone": "肤色",
        "bodyType": "体型",
        "distinguishingFeatures": ["显著特征1", "显著特征2"]
      },
      "identityLock": {
        "faceSignature": "面部特征签名（一句话概括）",
        "bodySignature": "身体特征签名（一句话概括）",
        "motionSignature": "举止动作描述",
        "visualAnchorTokens": ["视觉锚点1", "视觉锚点2"]
      },
      "personality": ["性格1", "性格2"],
      "plotContext": "该角色在剧本中的核心剧情（30字内）"
    }
  ]
}

注意：
- 年龄不要用"成年""少年"等泛指词，用具体年龄（如"七岁""二十岁"）
- 如果角色在剧本中有直接描述外貌，优先使用剧本中的描述
- 每个角色必须有一个 plotContext 说明其在故事中的定位
- 严格 JSON 格式，不包含任何其他文字`

export async function extractCharacters(script: string): Promise<{ characters: CharacterProfile[] }> {
  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: script.slice(0, 8000),
    timeoutTier: 'normal',
    userId: 'agent_character',
  })

  if (!result.ok || !result.content) {
    throw new Error(result.degraded ? 'LLM 降级' : '角色提取失败')
  }

  // Parse JSON from LLM output
  const content = result.content.trim()
  // LLM sometimes wraps JSON in markdown code blocks
  const jsonStr = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(jsonStr)

  if (!parsed.characters || !Array.isArray(parsed.characters)) {
    throw new Error('LLM 返回格式错误：缺少 characters 数组')
  }

  return parsed
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

