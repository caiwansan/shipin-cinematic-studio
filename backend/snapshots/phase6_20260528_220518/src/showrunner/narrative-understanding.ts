/**
 * Showrunner Core — Layer 1: Narrative Understanding
 *
 * 叙事理解层：输入完整剧本，输出结构化叙事语义。
 * 不生成内容，只做理解。
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Narrative Understanding
// ============================================================

export interface NarrativeUnderstanding {
  theme: string
  genre: string
  subGenres: string[]
  coreConflict: string
  logline: string
  characterNetwork: CharacterNode[]
  storyWorld: string
  narrativeBeats: NarrativeBeat[]
  totalEpisodes: number
  estimatedDuration: number  // 总时长（分钟）
}

export interface CharacterNode {
  id: string
  name: string
  role: 'protagonist' | 'antagonist' | 'deuteragonist' | 'supporting' | 'minor'
  arc: string
  relationshipToProtagonist: string
}

export interface NarrativeBeat {
  beatNumber: number
  name: string
  description: string
  type: 'inciting_incident' | 'rising_action' | 'midpoint' | 'all_is_lost' | 'climax' | 'resolution'
  intensity: number
}

const SYSTEM_PROMPT = [
  '你是一位顶级剧本分析师和叙事结构专家。',
  '分析剧本，提取结构化叙事语义。',
  '',
  '你必须输出严格有效的 JSON。所有字段都是必需的，如果未知则使用空数组或空字符串但绝不省略字段。',
  '',
  '必须包含以下字段：',
  '- theme: 核心主题（如"寻找自我"）',
  '- genre: 主要类型（如"科幻"）',
  '- subGenres: 子类型列表（如["赛博朋克","成长"]）',
  '- coreConflict: 核心冲突描述',
  '- logline: 一句话梗概',
  '- characterNetwork: 角色网络，每个角色必须包含 id/name/role(protagonist|antagonist|supporting)/arc。至少提取 3-5 个角色。',
  '- storyWorld: 世界观描述',
  '- narrativeBeats: 叙事节拍数组，至少 3-7 个。每个节拍包含 beatNumber/name/description/type(inciting_incident|rising_action|midpoint|all_is_lost|climax|resolution)/intensity(1-10)',
  '- totalEpisodes: 预计集数（1-60）',
  '- estimatedDuration: 预计总时长（分钟）',
  '',
  '示例输出格式：',
  '{"theme":"反抗与救赎","genre":"科幻","subGenres":["赛博朋克","冒险"],"coreConflict":"在一个被AI统治的城市中，一个普通快递员发现自己的记忆被篡改","logline":"...","characterNetwork":[{"id":"c1","name":"张明","role":"protagonist","arc":"从逃避到直面真相","relationshipToProtagonist":"自己"}],"storyWorld":"2099年，新上海","narrativeBeats":[{"beatNumber":1,"name":"快递异常","description":"张明收到一个不属于任何人的包裹","type":"inciting_incident","intensity":7}],"totalEpisodes":12,"estimatedDuration":360}',
  '',
  '再次强调：输出纯 JSON，不要加 markdown 包裹或代码块标记。',
].join('\n')

export async function analyzeNarrative(script: string, traceId?: string, userId?: string): Promise<NarrativeUnderstanding> {
  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: script.slice(0, 8000),
    userId: userId || 'showrunner-narrative',
    timeoutTier: 'normal',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    const enriched: NarrativeUnderstanding = {
      theme: parsed.theme || '',
      genre: parsed.genre || '通用',
      subGenres: parsed.subGenres || [],
      coreConflict: parsed.coreConflict || '',
      logline: parsed.logline || '',
      characterNetwork: (parsed.characterNetwork || []).map((c: any) => ({
        id: c.id || `char_${Math.random().toString(36).slice(2, 8)}`,
        name: c.name || '未命名',
        role: c.role || 'supporting',
        arc: c.arc || '',
        relationshipToProtagonist: c.relationshipToProtagonist || '',
      })),
      storyWorld: parsed.storyWorld || '',
      narrativeBeats: (parsed.narrativeBeats || []).map((b: any) => ({
        beatNumber: b.beatNumber || 1,
        name: b.name || '',
        description: b.description || '',
        type: b.type || 'rising_action',
        intensity: b.intensity || 5,
      })),
      totalEpisodes: parsed.totalEpisodes || 1,
      estimatedDuration: parsed.estimatedDuration || 30,
    }
    return enriched
  } catch {
    // JSON parse 失败 — 尝试从纯文本提取最小结构
    const lines = result.content.split('\n').filter(l => l.trim())
    const fallback: NarrativeUnderstanding = {
      theme: lines.find(l => l.includes('主题'))?.replace(/.*[：:]\s*/, '') || result.content.slice(0, 100),
      genre: '通用',
      subGenres: [],
      coreConflict: '',
      logline: result.content.slice(0, 200),
      characterNetwork: [],
      storyWorld: '',
      narrativeBeats: [],
      totalEpisodes: 3,
      estimatedDuration: 60,
    }
    return fallback
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

