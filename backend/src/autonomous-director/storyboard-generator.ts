/**
 * Storyboard Generator
 * Phase 8 — Autonomous Director Layer
 *
 * 自动分镜生成器：根据导演意图生成完整的故事板。
 *
 * 生成策略：
 *   - 根据意图的篇幅和风格自动确定场景数量
 *   - 每个场景包含场景名、shot 数量和 shot 类型分布
 *   - shot 类型根据风格自动分布（cinematic 多特写/远景切换）
 */

import { DirectorIntent } from './goal-interpreter'

export interface StoryboardScene {
  id: string
  name: string
  shots: number
  shotTypes: string[]
  narrativeBeat: string
}

export interface Storyboard {
  title: string
  scenes: StoryboardScene[]
  style: string
  totalShots: number
}

export class StoryboardGenerator {
  private shotTypePool: Record<string, string[]> = {
    cinematic: ['近景', '特写', '中景', '远景', '过肩', '航拍'],
    documentary: ['广角', '中景', '跟拍', '固定', '采访'],
    experimental: ['鱼眼', '倾斜', '跳切', '慢镜', '微距'],
    anime: ['特写', '全景', '俯视', '仰视', '奔跑', '慢镜'],
    default: ['近景', '中景', '远景', '特写'],
  }

  private beatPool = [
    '建立空间', '引入角色', '冲突建立', '情感转折', '高潮推进',
    '危机爆发', '氛围过渡', '角色弧光', '结局落定',
  ]

  /**
   * 根据导演意图生成完整故事板
   */
  generate(intent: DirectorIntent): Storyboard {
    const shots = this.shotTypePool[intent.style] || this.shotTypePool.default
    const sceneCount = this.resolveSceneCount(intent)
    const scenes: StoryboardScene[] = []

    for (let i = 0; i < sceneCount; i++) {
      const shotCount = this.randomInt(
        intent.duration === 'short' ? 1 : 2,
        intent.duration === 'long' ? 6 : 4,
      )

      // 从 shotTypePool 轮询抽取
      const shotTypes: string[] = []
      for (let s = 0; s < shotCount; s++) {
        shotTypes.push(shots[s % shots.length])
      }

      scenes.push({
        id: `scene_auto_${i + 1}`,
        name: this.generateSceneName(intent, i, sceneCount),
        shots: shotCount,
        shotTypes,
        narrativeBeat: this.beatPool[i % this.beatPool.length],
      })
    }

    return {
      title: this.generateTitle(intent),
      scenes,
      style: intent.style,
      totalShots: scenes.reduce((sum, s) => sum + s.shots, 0),
    }
  }

  private resolveSceneCount(intent: DirectorIntent): number {
    if (intent.sceneHint) return intent.sceneHint
    const countMap: Record<string, number> = {
      short: 3,
      medium: 5,
      long: 8,
    }
    return countMap[intent.duration] || 3
  }

  private generateSceneName(intent: DirectorIntent, index: number, total: number): string {
    const names: Record<string, string[]> = {
      dramatic: ['序幕', '冲突', '展开', '转折', '高潮', '回落', '尾声', '终局'],
      light: ['开端', '遇见', '发展', '波折', '欢聚', '释然'],
      tense: ['预警', '逼近', '爆发', '追击', '对抗', '逆转', '幸存'],
    }

    const pool = names[intent.mood] || names.dramatic
    return pool[index % pool.length] || `场景 ${index + 1}`
  }

  private generateTitle(intent: DirectorIntent): string {
    const styleLabel: Record<string, string> = {
      cinematic: '电影感',
      documentary: '纪录片',
      experimental: '实验',
      anime: '动画',
      default: '',
    }
    return `${styleLabel[intent.style] || ''}${intent.intent === 'narrative_generation' ? '自动生成' : ''}`.trim() || '无标题'
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
