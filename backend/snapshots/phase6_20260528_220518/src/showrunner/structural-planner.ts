/**
 * Showrunner Core — Layer 3: Structural Planner
 *
 * 将全集剧本转为"生产结构"：
 * - 每集目标
 * - 每集冲突强度
 * - 爆点位置
 * - 情绪推进逻辑
 * - 集与集之间的钩子连接
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

// ============================================================
// Episode Blueprint
// ============================================================

export interface SeriesBlueprint {
  episodes: EpisodeBlueprint[]
  overallStructure: string
  criticalEpisodes: number[]  // 关键集索引
}

export interface EpisodeBlueprint {
  episode: number
  title: string
  goal: string
  hook: boolean
  cliffhanger: boolean
  conflictLevel: number       // 1-10
  emotionalTheme: string
  keyScenes: string[]
  runtimeMinutes: number
  priority: 'high' | 'medium' | 'low'
  dependencies: number[]      // 依赖的集号
}

const SYSTEM_PROMPT = `你是一位资深制片人和剧集结构设计师。
根据叙事理解和情绪架构，输出全集制作蓝图。

每集必须包含：
- 该集叙事目标（建立/推进/高潮/收束）
- 是否有钩子引导下一集
- 是否以悬念结尾
- 冲突强度 1-10
- 情绪主题
- 关键场景
- 预计时长
- 制作优先级
- 依赖关系

输出 JSON:
{
  "episodes": [
    {
      "episode": 1,
      "title": "集标题",
      "goal": "角色建立，引入世界观",
      "hook": true,
      "cliffhanger": true,
      "conflictLevel": 3,
      "emotionalTheme": "好奇",
      "keyScenes": ["开场", "冲突引入", "悬念结尾"],
      "runtimeMinutes": 5,
      "priority": "high",
      "dependencies": []
    }
  ],
  "overallStructure": "全剧结构概述",
  "criticalEpisodes": [1, 10, 30, 50, 60]
}`

export async function generateBlueprint(
  narrative: any,
  emotionalArchitecture: any,
  totalEpisodes: number,
  traceId?: string,
  userId?: string,
): Promise<SeriesBlueprint> {
  const userPrompt = `【叙事理解】${JSON.stringify(narrative, null, 2)}\n【情绪架构】${JSON.stringify(emotionalArchitecture, null, 2)}\n【总集数】${totalEpisodes}`

  const result = await narrativeGateway.execute({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userPrompt.slice(0, 7000),
    userId: userId || 'showrunner-planner',
    timeoutTier: 'batch',
  })

  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, result.content]
    const parsed = JSON.parse(jsonMatch[1].trim())
    return {
      episodes: (parsed.episodes || []).slice(0, totalEpisodes),
      overallStructure: parsed.overallStructure || '',
      criticalEpisodes: parsed.criticalEpisodes || [1, Math.floor(totalEpisodes / 2), totalEpisodes],
    }
  } catch {
    const episodes: EpisodeBlueprint[] = []
    for (let i = 1; i <= totalEpisodes; i++) {
      episodes.push({
        episode: i,
        title: `第${i}集`,
        goal: i === 1 ? '开场建立' : i === totalEpisodes ? '高潮结局' : '剧情推进',
        hook: i < totalEpisodes,
        cliffhanger: i < totalEpisodes,
        conflictLevel: Math.min(3 + Math.floor(i / 8), 10),
        emotionalTheme: '发展',
        keyScenes: ['开场', '推进', '结尾'],
        runtimeMinutes: 5,
        priority: i === 1 || i === totalEpisodes ? 'high' : 'medium',
        dependencies: i > 1 ? [i - 1] : [],
      })
    }
    return {
      episodes,
      overallStructure: `${totalEpisodes}集结构`,
      criticalEpisodes: [1, Math.floor(totalEpisodes / 2), totalEpisodes],
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

