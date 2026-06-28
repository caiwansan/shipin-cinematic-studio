/**
 * Showrunner Core — Layer 2: Emotional Engine
 *
 * 情绪建模层：建立全集情绪曲线，标记每集情绪状态，
 * 定义观众心理节奏，确保全剧情绪有起伏不单调。
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Emotional Architecture
// ============================================================

export interface EmotionalArchitecture {
  seriesEmotionCurve: EpisodeEmotion[]
  emotionalThemes: EmotionalTheme[]
  audienceEngagementPlan: EngagementPhase[]
  riskBeats: RiskBeat[]
  overallArc: string
}

export interface EpisodeEmotion {
  episode: number
  primaryEmotion: string
  secondaryEmotion: string
  intensity: number        // 1-10
  tension: number          // 1-10
  relief: number           // 1-10
  hookStrength: number     // 1-10
  cliffhanger: boolean
}

export interface EmotionalTheme {
  episodes: [number, number]
  theme: string
  dominantEmotion: string
  purpose: string
}

export interface EngagementPhase {
  episodes: [number, number]
  phaseName: string
  strategy: string
  retentionGoal: number
}

export interface RiskBeat {
  episode: number
  type: 'character_death' | 'betrayal' | 'revelation' | 'loss' | 'victory'
  impactLevel: number
  recoveryStrategy: string
}

const SYSTEM_PROMPT = `你是一位资深情绪设计师和观众心理专家。
根据叙事理解，设计完整的情绪架构。

短剧情绪设计原则：
1. 每集必须有情绪起伏
2. 每隔 3-5 集必须有情绪转折
3. 高潮集情绪强度 ≥ 9/10
4. 结尾必须留钩子
5. 全剧必须有一条情绪主线

输出 JSON:
{
  "seriesEmotionCurve": [
    { "episode": 1, "primaryEmotion": "好奇", "secondaryEmotion": "期待", "intensity": 5, "tension": 3, "relief": 2, "hookStrength": 8, "cliffhanger": true }
  ],
  "emotionalThemes": [
    { "episodes": [1, 10], "theme": "建立", "dominantEmotion": "好奇", "purpose": "让观众了解世界" }
  ],
  "audienceEngagementPlan": [
    { "episodes": [1, 5], "phaseName": "钩子期", "strategy": "密集钩子建立观看习惯", "retentionGoal": 80 }
  ],
  "riskBeats": [],
  "overallArc": "全剧情绪主线描述"
}`

export async function buildEmotionalArchitecture(
  narrative: any,
  totalEpisodes: number,
  traceId?: string,
  userId?: string,
): Promise<EmotionalArchitecture> {
  const userPrompt = `【叙事理解】\n${JSON.stringify(narrative, null, 2)}\n\n【总集数】${totalEpisodes}\n\n请设计${totalEpisodes}集的完整情绪架构。`

  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt,
    userId: userId || 'showrunner-emotion',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      seriesEmotionCurve: (parsed.seriesEmotionCurve || []).slice(0, totalEpisodes).map((e: any) => ({
        episode: e.episode || 1,
        primaryEmotion: e.primaryEmotion || '中性',
        secondaryEmotion: e.secondaryEmotion || '平静',
        intensity: e.intensity || 5,
        tension: e.tension || 5,
        relief: e.relief || 5,
        hookStrength: e.hookStrength || 5,
        cliffhanger: e.cliffhanger || false,
      })),
      emotionalThemes: parsed.emotionalThemes || [],
      audienceEngagementPlan: parsed.audienceEngagementPlan || [],
      riskBeats: parsed.riskBeats || [],
      overallArc: parsed.overallArc || '',
    }
  } catch {
    const episodes: EpisodeEmotion[] = []
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push({
        episode: i,
        primaryEmotion: i === totalEpisodes ? '高潮' : '发展',
        secondaryEmotion: '期待',
        intensity: Math.min(3 + Math.floor(i / 10), 10),
        tension: Math.min(3 + Math.floor(i / 8), 10),
        relief: Math.max(10 - Math.floor(i / 6), 1),
        hookStrength: i % 3 === 0 ? 9 : 5,
        cliffhanger: i < totalEpisodes,
      })
    }
    return {
      seriesEmotionCurve: episodes,
      emotionalThemes: [{ episodes: [1, totalEpisodes], theme: '全剧主线', dominantEmotion: '发展', purpose: '推进剧情' }],
      audienceEngagementPlan: [],
      riskBeats: [],
      overallArc: '',
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

