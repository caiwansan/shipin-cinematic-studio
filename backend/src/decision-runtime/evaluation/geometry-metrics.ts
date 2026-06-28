/**
 * geometry-metrics.ts — P1.3 Evaluation Geometry: Geometry Metrics
 *
 * 前沿面分析指标:
 * - frontierSize: 前沿面中的候选数
 * - frontierDensity: 前沿面在轴空间中的"密集度"
 * - dominanceRatio: 支配关系密度
 * - scoreEntropy: 得分分布的信息熵
 * - vectorSpread: 前沿面向量的离散度
 */

export interface GeometryMetrics {
  frontierSize: number
  totalCandidates: number
  frontierRatio: number
  frontierDensity: number
  dominanceRatio: number
  scoreEntropy: number
  vectorSpread: number[]
  axisAverages: number[]
  axisStdDevs: number[]
}

/**
 * 计算几何指标
 */
export function computeGeometryMetrics(
  frontier: number[][],      // 前沿面向量列表
  allVectors: number[][],    // 全体向量列表
  relations: number,         // 支配关系数量
): GeometryMetrics {
  const nAxes = frontier.length > 0 ? frontier[0].length : 7

  // 前沿大小
  const frontierSize = frontier.length
  const totalCandidates = allVectors.length
  const frontierRatio = totalCandidates > 0 ? frontierSize / totalCandidates : 0

  // 前沿密度: 前沿面候选间的平均距离（越小越密集）
  const frontierDensity = computeFrontierDensity(frontier)

  // 支配比例: 支配关系数量 / 可能的支配对总数
  const possiblePairs = totalCandidates * (totalCandidates - 1)
  const dominanceRatio = possiblePairs > 0 ? relations / possiblePairs : 0

  // 得分熵: 所有候选原始得分的分布熵
  const scoreEntropy = allVectors.length > 0 ? computeScoreEntropy(allVectors.map(() => 1)) : 0

  // 各轴离散度
  const vectorSpread = computeVectorSpread(frontier, nAxes)

  // 各轴均值/标准差（空输入时返回全0）
  const axisAverages: number[] = []
  const axisStdDevs: number[] = []
  if (allVectors.length === 0) {
    for (let i = 0; i < nAxes; i++) {
      axisAverages.push(0)
      axisStdDevs.push(0)
    }
  } else {
    for (let i = 0; i < nAxes; i++) {
      const vals = allVectors.map(v => v[i] || 0)
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      axisAverages.push(avg)
      const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length
      axisStdDevs.push(Math.sqrt(variance))
    }
  }

  return {
    frontierSize,
    totalCandidates,
    frontierRatio,
    frontierDensity,
    dominanceRatio,
    scoreEntropy,
    vectorSpread,
    axisAverages,
    axisStdDevs,
  }
}

/**
 * 前沿面密度: 候选之间的欧氏距离均值
 * 值越小 → 前沿面越密集（候选差异小）
 * 值越大 → 前沿面越分散（候选差异大）
 */
function computeFrontierDensity(frontier: number[][]): number {
  if (frontier.length <= 1) return 0

  let totalDist = 0
  let pairs = 0
  for (let i = 0; i < frontier.length; i++) {
    for (let j = i + 1; j < frontier.length; j++) {
      let dist = 0
      for (let k = 0; k < frontier[i].length; k++) {
        dist += (frontier[i][k] - frontier[j][k]) ** 2
      }
      totalDist += Math.sqrt(dist)
      pairs++
    }
  }
  return pairs > 0 ? totalDist / pairs : 0
}

/**
 * 各轴离散度: 每个轴上值的标准差
 * 值高 → 该轴在候选间差异大（强区分度）
 * 值低 → 该轴在所有候选上趋同（弱区分度）
 */
function computeVectorSpread(vectors: number[][], nAxes: number): number[] {
  if (vectors.length === 0) return new Array(nAxes).fill(0)

  const spread: number[] = []
  for (let i = 0; i < nAxes; i++) {
    const vals = vectors.map(v => v[i])
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length
    spread.push(Math.sqrt(variance))
  }
  return spread
}

/**
 * 得分熵: 候选得分归一化后的 Shannon 熵
 * 高熵 → 均匀分布（多样性好）
 * 低熵 → 集中在少数候选（头部效应强）
 */
function computeScoreEntropy(scores: number[]): number {
  if (scores.length === 0) return 0
  const total = scores.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const probabilities = scores.map(s => s / total).filter(p => p > 0)
  return -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0)
}
