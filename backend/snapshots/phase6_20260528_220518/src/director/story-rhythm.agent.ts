/**
 * Story Rhythm Agent
 *
 * 短剧核心智能体：
 * - 爆点设计（每 15-30 秒一个钩子）
 * - 情绪波峰规划
 * - 节奏切换（setup → tension → escalation → climax → release）
 * - 反转时机
 * - 钩子密度控制
 *
 * 节奏是短剧的核心竞争力
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Rhythm Design
// ============================================================

export interface RhythmDesign {
  structure: {
    type: 'three_act' | 'five_act' | 'episodic' | 'non_linear'
    description: string
  }
  beats: RhythmBeat[]
  hooks: Hook[]
  reversals: Reversal[]
  pacingSummary: {
    totalBeats: number
    totalHooks: number
    averageHookInterval: number  // seconds
    peakIntensity: number
    climaxBeat: string
  }
}

export interface RhythmBeat {
  beatNumber: number
  name: string
  phase: 'setup' | 'tension' | 'escalation' | 'climax' | 'release'
  duration: number  // seconds
  intensity: number // 1-10
  emotion: string
  description: string
}

export interface Hook {
  hookNumber: number
  timing: number  // seconds from start
  type: 'dialogue' | 'visual' | 'action' | 'revelation' | 'cliffhanger'
  description: string
  retensionScore: number // 1-10
}

export interface Reversal {
  reversalNumber: number
  timing: number  // seconds from start
  type: 'plot_twist' | 'character_reveal' | 'emotional_shift' | 'power_dynamic'
  description: string
  impact: number // 1-10
}

const SYSTEM_PROMPT = `你是一位爆款短剧节奏大师和叙事设计师。
你的工作是分析剧本，设计能让观众欲罢不能的节奏方案。

【重要】导演理解中的 _storyConstitution 字段包含了 AIGC 制作规格（叙事结构、情绪规格、节奏参考等）。你的节奏设计必须与这些规格中的叙事方向保持一致，确保节奏服务于故事主线。

短剧核心法则：
1. 每 15-30 秒必须有一个钩子
2. 每 60-90 秒必须有一个情绪爆点
3. 至少 2 个反转
4. 5 分钟总时长内完成 setup → climax → release
5. 高潮强度必须 ≥ 9/10

输出 JSON:
{
  "structure": {
    "type": "three_act|five_act|episodic|non_linear",
    "description": "结构说明"
  },
  "beats": [{
    "beatNumber": 1,
    "name": "节拍名称",
    "phase": "setup|tension|escalation|climax|release",
    "duration": 时长秒数,
    "intensity": 强度1-10,
    "emotion": "情绪",
    "description": "描述"
  }],
  "hooks": [{
    "hookNumber": 1,
    "timing": 触发时间秒,
    "type": "dialogue|visual|action|revelation|cliffhanger",
    "description": "钩子描述",
    "retensionScore": 留存力1-10
  }],
  "reversals": [{
    "reversalNumber": 1,
    "timing": 时间秒,
    "type": "plot_twist|character_reveal|emotional_shift|power_dynamic",
    "description": "反转描述",
    "impact": 冲击力1-10
  }],
  "pacingSummary": {
    "totalBeats": 总节拍数,
    "totalHooks": 总钩子数,
    "averageHookInterval": 平均钩子间隔秒,
    "peakIntensity": 最大强度,
    "climaxBeat": "高潮节拍名称"
  }
}`

export async function generateRhythmDesign(
  script: string,
  directorUnderstanding: any,
  traceId?: string,
): Promise<RhythmDesign> {
  const userPrompt = `【剧本】\n${script.slice(0, 4000)}\n\n【导演理解】\n${JSON.stringify(directorUnderstanding, null, 2)}

【故事宪法】
（以下字段为 AIGC 制作规格，是你的节奏设计蓝本）
- narrativeSpec: 叙事结构和分段
- emotionSpecs: 情绪变化曲线要求
- rhythmSpec: 已有节奏参考
- dialogSpec: 对话密度分布`


  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt,
    userId: 'story-rhythm',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      structure: parsed.structure || { type: 'three_act', description: '经典三幕结构' },
      beats: (parsed.beats || []).map((b: any) => ({
        beatNumber: b.beatNumber || 1,
        name: b.name || '',
        phase: b.phase || 'setup',
        duration: b.duration || 60,
        intensity: b.intensity || 5,
        emotion: b.emotion || '中性',
        description: b.description || '',
      })),
      hooks: (parsed.hooks || []).map((h: any) => ({
        hookNumber: h.hookNumber || 1,
        timing: h.timing || 0,
        type: h.type || 'action',
        description: h.description || '',
        retensionScore: h.retensionScore || 5,
      })),
      reversals: (parsed.reversals || []).map((r: any) => ({
        reversalNumber: r.reversalNumber || 1,
        timing: r.timing || 0,
        type: r.type || 'plot_twist',
        description: r.description || '',
        impact: r.impact || 5,
      })),
      pacingSummary: parsed.pacingSummary || {
        totalBeats: (parsed.beats || []).length,
        totalHooks: (parsed.hooks || []).length,
        averageHookInterval: 30,
        peakIntensity: 9,
        climaxBeat: '高潮',
      },
    }
  } catch {
    return {
      structure: { type: 'three_act', description: '经典三幕结构' },
      beats: [],
      hooks: [],
      reversals: [],
      pacingSummary: { totalBeats: 0, totalHooks: 0, averageHookInterval: 30, peakIntensity: 5, climaxBeat: '未知' },
    }
  }
}
