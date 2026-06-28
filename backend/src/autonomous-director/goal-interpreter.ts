/**
 * Goal Interpreter
 * Phase 8 — Autonomous Director Layer
 *
 * 目标解析器：将自然语言/结构化目标解析为可执行的导演指令。
 *
 * 核心能力：
 *   - parse: 将输入字符串解析为结构化 Intent
 *   - 支持风格约束（cinematic / documentary / experimental）
 *   - 支持篇幅约束（short / medium / long）
 *   - 支持情感基调约束（dramatic / light / tense）
 */

export interface DirectorIntent {
  /** 意图类型 */
  intent: 'narrative_generation' | 'scene_optimization' | 'style_transfer' | 'continuation'
  /** 风格约束 */
  style: 'cinematic' | 'documentary' | 'experimental' | 'anime' | 'default'
  /** 篇幅约束 */
  duration: 'short' | 'medium' | 'long'
  /** 情感基调 */
  mood: 'dramatic' | 'light' | 'tense' | 'neutral'
  /** 场景数量提示（可选） */
  sceneHint?: number
  /** 原始输入（留作 audit） */
  raw: string
}

export class GoalInterpreter {
  private styleMap: Record<string, DirectorIntent['style']> = {
    cinematic: 'cinematic',
    电影: 'cinematic',
    documentary: 'documentary',
    纪录片: 'documentary',
    experimental: 'experimental',
    实验: 'experimental',
    anime: 'anime',
    动画: 'anime',
  }

  private moodMap: Record<string, DirectorIntent['mood']> = {
    dramatic: 'dramatic',
    戏剧: 'dramatic',
    紧张: 'tense',
    tense: 'tense',
    light: 'light',
    轻松: 'light',
  }

  /**
   * 解析目标字符串为导演意图
   */
  parse(input: string): DirectorIntent {
    const lower = input.toLowerCase()

    // 意图识别
    let intent: DirectorIntent['intent'] = 'narrative_generation'
    if (lower.includes('续写') || lower.includes('继续') || lower.includes('continu')) {
      intent = 'continuation'
    } else if (lower.includes('优化') || lower.includes('optimize')) {
      intent = 'scene_optimization'
    }

    // 风格匹配
    const style = this.matchStyle(lower) || 'default'

    // 篇幅匹配
    let duration: DirectorIntent['duration'] = 'medium'
    if (lower.includes('短') || lower.includes('brief') || lower.includes('short')) {
      duration = 'short'
    } else if (lower.includes('长') || lower.includes('long') || lower.includes('长篇')) {
      duration = 'long'
    }

    // 情感基调
    const mood = this.matchMood(lower) || 'neutral'

    // 场景数量提示（若有数字）
    const sceneMatch = input.match(/(\d+)\s*[个场]/)
    const sceneHint = sceneMatch ? parseInt(sceneMatch[1]) : undefined

    return { intent, style, duration, mood, sceneHint, raw: input }
  }

  /**
   * 根据意图生成默认故事结构参数
   */
  getDefaultStructure(intent: DirectorIntent): {
    sceneCount: number
    shotsPerScene: [number, number]
  } {
    const sceneCountMap: Record<string, number> = {
      short: intent.sceneHint || 3,
      medium: intent.sceneHint || 5,
      long: intent.sceneHint || 8,
    }

    const shotsRangeMap: Record<string, [number, number]> = {
      short: [1, 2],
      medium: [2, 4],
      long: [3, 6],
    }

    return {
      sceneCount: sceneCountMap[intent.duration],
      shotsPerScene: shotsRangeMap[intent.duration],
    }
  }

  private matchStyle(text: string): DirectorIntent['style'] | undefined {
    for (const [key, value] of Object.entries(this.styleMap)) {
      if (text.includes(key)) return value
    }
    return undefined
  }

  private matchMood(text: string): DirectorIntent['mood'] | undefined {
    for (const [key, value] of Object.entries(this.moodMap)) {
      if (text.includes(key)) return value
    }
    return undefined
  }
}
