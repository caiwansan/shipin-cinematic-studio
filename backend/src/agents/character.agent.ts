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

import { buildPromptCached } from './prompt-service.js'

// ⭐ 从 PromptService 读取（统一入口）
let systemPromptPromise: Promise<string> | null = null
async function getSystemPrompt(): Promise<string> {
  if (!systemPromptPromise) {
    systemPromptPromise = (async () => {
      const result = await buildPromptCached({ agentName: 'character-agent' })
      return result.prompt
    })()
  }
  return systemPromptPromise
}

export async function extractCharacters(script: string): Promise<{ characters: CharacterProfile[] }> {
  const result = await narrativeGateway.execute({
    systemPrompt: await getSystemPrompt(),
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

