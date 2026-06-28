/**
 * Load Pattern Engine — 流量模式
 * 
 * 4 种真实世界流量模型：Burst / Wave / Crawl / Chaos
 * 输出时间线：每个时间点的并发请求数
 */

export type PatternType = 'burst' | 'wave' | 'crawl' | 'chaos'

export interface LoadPattern {
  name: PatternType
  label: string
  description: string
  /** 生成时间线：每秒的并发请求数 */
  generateTimeline(durationSeconds: number): number[]
}

// ============================================================
// Burst（爆发流）
// ============================================================

export const burstPattern: LoadPattern = {
  name: 'burst',
  label: '爆发流',
  description: '0 → 100 瞬时爆发 → 衰减',

  generateTimeline(durationSeconds: number): number[] {
    const timeline: number[] = []
    let remainingBurst = 0

    for (let t = 0; t < durationSeconds; t++) {
      // 每 30s 一次爆发
      if (t % 30 === 0) {
        remainingBurst = 50 + Math.floor(Math.random() * 50)  // 50~100 爆发
      }

      if (remainingBurst > 0) {
        const burstThisSecond = Math.min(
          remainingBurst,
          10 + Math.floor(Math.random() * 20)  // 每秒 10~30 请求
        )
        timeline.push(burstThisSecond)
        remainingBurst -= burstThisSecond
      } else {
        timeline.push(Math.floor(Math.random() * 3))  // 安静期
      }
    }

    return timeline
  },
}

// ============================================================
// Wave（波动流）
// ============================================================

export const wavePattern: LoadPattern = {
  name: 'wave',
  label: '波动流',
  description: '正弦波周期性上下浮动',

  generateTimeline(durationSeconds: number): number[] {
    const timeline: number[] = []
    const period = 20  // 20s 一个周期

    for (let t = 0; t < durationSeconds; t++) {
      const phase = (t % period) / period * Math.PI * 2
      // 正弦波，5~25 并发
      const concurrency = Math.round(10 + 15 * Math.abs(Math.sin(phase)))
      timeline.push(concurrency)
    }

    return timeline
  },
}

// ============================================================
// Crawl（慢流量）
// ============================================================

export const crawlPattern: LoadPattern = {
  name: 'crawl',
  label: '慢流量',
  description: '稳定低频，模拟清晨/深夜',

  generateTimeline(durationSeconds: number): number[] {
    const timeline: number[] = []
    // 每秒 1~5 请求，平稳
    for (let t = 0; t < durationSeconds; t++) {
      timeline.push(Math.ceil(Math.random() * 4))
    }
    return timeline
  },
}

// ============================================================
// Chaos（真实世界）
// ============================================================

export const chaosPattern: LoadPattern = {
  name: 'chaos',
  label: '混沌流',
  description: '爆发 + 波动 + 慢流量随机混合',

  generateTimeline(durationSeconds: number): number[] {
    const timeline: number[] = []

    for (let t = 0; t < durationSeconds; t++) {
      const roll = Math.random()

      if (roll < 0.1) {
        // 10% 爆发
        timeline.push(30 + Math.floor(Math.random() * 50))
      } else if (roll < 0.3) {
        // 20% 中负载
        timeline.push(10 + Math.floor(Math.random() * 20))
      } else if (roll < 0.6) {
        // 30% 低负载
        timeline.push(2 + Math.floor(Math.random() * 8))
      } else {
        // 40% 突发 cancel
        timeline.push(0)
      }
    }

    return timeline
  },
}

// ============================================================
// 注册表
// ============================================================

export const ALL_PATTERNS: LoadPattern[] = [
  burstPattern,
  wavePattern,
  crawlPattern,
  chaosPattern,
]

export function getPatternByName(name: PatternType): LoadPattern {
  return ALL_PATTERNS.find(p => p.name === name) ?? chaosPattern
}
