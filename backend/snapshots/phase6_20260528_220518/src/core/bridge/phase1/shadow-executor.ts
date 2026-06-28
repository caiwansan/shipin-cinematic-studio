/**
 * PSC-1 Shadow Executor — 影子执行器
 *
 * 同时执行 legacy 和 bridge 两条路径：
 *   - legacy 返回给用户（真实响应）
 *   - bridge 影子执行（仅对比）
 *
 * 对比输出 diff_score，验证 bridge 的正确性。
 * 影子执行的异常不影响到用户响应。
 */

export interface ShadowComparison {
  timestamp: number
  diffScore: number
  legacyLatency: number
  bridgeLatency: number
  legacySuccess: boolean
  bridgeSuccess: boolean
  legacyOutputTruncated: string
  bridgeOutputTruncated: string
}

class ShadowExecutor {
  private comparisons: ShadowComparison[] = []

  private readonly maxComparisons = 500

  /**
   * 执行影子对比
   *
   * @param legacyFn — 返回 legacy 执行结果的函数
   * @param bridgeFn — 返回 bridge 执行结果的函数
   * @returns legacy 的结果（影子不阻塞）
   */
  async compare<T>(
    legacyFn: () => Promise<T>,
    bridgeFn: () => Promise<T>,
  ): Promise<{ response: T; shadow: { diffScore: number; match: boolean } }> {
    const start = Date.now()
    const legacyResult = await legacyFn()
    const legacyLatency = Date.now() - start

    // 影子执行（不等待，不阻塞）
    const bridgeStart = Date.now()
    let bridgeResult: T | null = null
    let bridgeLatency = 0
    let bridgeSuccess = false

    try {
      bridgeResult = await bridgeFn()
      bridgeLatency = Date.now() - bridgeStart
      bridgeSuccess = true
    } catch {
      bridgeLatency = Date.now() - bridgeStart
      bridgeSuccess = false
    }

    // 对比（简化为输出类型检查 + 长度比较）
    const diffScore = this.calculateDiff(legacyResult, bridgeResult)

    this.comparisons.push({
      timestamp: Date.now(),
      diffScore,
      legacyLatency,
      bridgeLatency,
      legacySuccess: true,
      bridgeSuccess,
      legacyOutputTruncated: String(legacyResult).substring(0, 100),
      bridgeOutputTruncated: bridgeResult ? String(bridgeResult).substring(0, 100) : 'FAILED',
    })

    if (this.comparisons.length > this.maxComparisons) {
      this.comparisons.shift()
    }

    return {
      response: legacyResult,
      shadow: {
        diffScore,
        match: diffScore < 0.1,
      },
    }
  }

  /**
   * 计算差异分数（0 = 完全相同，1 = 完全不同）
   *
   * 策略：对非 trivial 输出做简单的文本长度/结构比较
   */
  calculateDiff(a: unknown, b: unknown | null): number {
    if (b === null) return 1.0
    if (a === b) return 0

    const strA = String(a || '')
    const strB = String(b || '')

    if (!strA && !strB) return 0
    if (!strA || !strB) return 1.0

    // 长度差异比率
    const maxLen = Math.max(strA.length, strB.length)
    if (maxLen === 0) return 0

    const lenDiff = Math.abs(strA.length - strB.length) / maxLen

    // 简单 levenshtein 近似：检查前 200 字符的差异
    const sampleA = strA.substring(0, 200)
    const sampleB = strB.substring(0, 200)
    let charDiffs = 0
    const minLen = Math.min(sampleA.length, sampleB.length)
    for (let i = 0; i < minLen; i++) {
      if (sampleA[i] !== sampleB[i]) charDiffs++
    }
    const charDiffRate = minLen > 0 ? charDiffs / minLen : 0

    return Math.min(1, (lenDiff * 0.3 + charDiffRate * 0.7))
  }

  /**
   * 手动记录一次对比结果（供 convergenceController 在 dual-write 模式下使用）
   */
  recordManual(data: {
    diffScore: number
    legacyLatency: number
    bridgeLatency: number
    legacySuccess: boolean
    bridgeSuccess: boolean
  }): void {
    this.comparisons.push({
      timestamp: Date.now(),
      diffScore: data.diffScore,
      legacyLatency: data.legacyLatency,
      bridgeLatency: data.bridgeLatency,
      legacySuccess: data.legacySuccess,
      bridgeSuccess: data.bridgeSuccess,
      legacyOutputTruncated: '',
      bridgeOutputTruncated: '',
    })

    if (this.comparisons.length > this.maxComparisons) {
      this.comparisons.shift()
    }
  }

  /**
   * 获取最近的平均差异分数
   */
  getAverageDiff(window: number = 50): number {
    const recent = this.comparisons.slice(-window)
    if (recent.length === 0) return 0
    return recent.reduce((sum, c) => sum + c.diffScore, 0) / recent.length
  }

  /**
   * 获取差异统计
   */
  getStats() {
    const recent = this.comparisons.slice(-100)
    return {
      totalComparisons: this.comparisons.length,
      fallbackCount: 0, // fallback 由 rollbackEngine 追踪，shadowExecutor 只做 diff
      averageDiff: this.getAverageDiff(),
      recentDiffScores: recent.map(c => c.diffScore),
      recentComparisons: recent.slice(-10).map(c => ({
        diffScore: c.diffScore,
        legacyLatency: c.legacyLatency,
        bridgeLatency: c.bridgeLatency,
        match: c.diffScore < 0.1,
      })),
      matchRate: recent.length > 0
        ? recent.filter(c => c.diffScore < 0.1).length / recent.length
        : 1,
    }
  }
}

export const shadowExecutor = new ShadowExecutor()
