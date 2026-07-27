/**
 * RankingService — 排名计算引擎
 *
 * 职责：在 P4-01 Match Score 之上叠加额外维度，生成最终排名
 * 设计原则：
 *   - 不修改 P4-01 Score（只读）
 *   - Ranking 公式版本化（rankingVersion）
 *   - 公式权重冻结：Score 70% + Evidence 20% + Freshness 10%
 *
 * ⚠️ Ranking ≠ Matching。Ranking 是排序决策，Matching 是能力评估。
 */

import { prisma } from '../../../utils/index.js';
import { talentMatchResultRepository } from '../repositories/talent-match-result.repository.js';
import { matchEvidenceRepository } from '../repositories/match-evidence.repository.js';

// ============================================================
// Types
// ============================================================

export interface RankingWeights {
  matchScore: number;    // P4-01 Score 权重
  evidenceConfidence: number;  // 证据置信度权重
  freshness: number;     // 新鲜度权重
}

export interface RankedResult {
  matchResultId: string;
  candidateId: string;
  profileId: string;
  matchScore: number;        // P4-01 原始分数（只读）
  rankingScore: number;      // 最终排名分数
  rank: number;              // 排名（1-based）
  rankingVersion: string;
  breakdown: {
    matchScore: number;
    evidenceConfidence: number;
    freshness: number;
  };
}

// ============================================================
// Constants — V1 Ranking Formula (FROZEN)
// ============================================================

const V1_WEIGHTS: RankingWeights = {
  matchScore: 0.70,
  evidenceConfidence: 0.20,
  freshness: 0.10,
};

const RANKING_VERSION = 'v1';

// ============================================================
// Pure Functions
// ============================================================

/**
 * 计算证据置信度分数 (0-100)
 * 取所有证据的置信度平均值
 */
function calculateEvidenceConfidence(evidenceConfidenceValues: number[]): number {
  if (evidenceConfidenceValues.length === 0) return 50; // 无证据时中性分
  const sum = evidenceConfidenceValues.reduce((a, b) => a + b, 0);
  return Math.round((sum / evidenceConfidenceValues.length) * 100);
}

/**
 * 计算新鲜度分数 (0-100)
 * 基于候选人资料更新时间
 *   - 7天内更新: 100
 *   - 30天内: 80
 *   - 90天内: 60
 *   - 180天内: 40
 *   - 超过180天: 20
 */
function calculateFreshness(updatedAt: Date): number {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate <= 7) return 100;
  if (daysSinceUpdate <= 30) return 80;
  if (daysSinceUpdate <= 90) return 60;
  if (daysSinceUpdate <= 180) return 40;
  return 20;
}

/**
 * 计算最终排名分数
 * 公式：matchScore × 0.7 + evidenceConf × 0.2 + freshness × 0.1
 */
function calculateRankingScore(
  matchScore: number,
  evidenceConf: number,
  freshness: number,
  weights: RankingWeights,
): number {
  return Math.round(
    matchScore * weights.matchScore +
    evidenceConf * weights.evidenceConfidence +
    freshness * weights.freshness,
  );
}

// ============================================================
// Ranking Service
// ============================================================

export const rankingService = {

  /**
   * 对一批匹配结果执行排名
   * @param matchResults — P4-01 匹配结果列表（含 evidence）
   * @returns 排名后的结果列表
   */
  async rankResults(matchResultIds: string[]): Promise<RankedResult[]> {
    const rankedResults: RankedResult[] = [];

    for (const id of matchResultIds) {
      // 1. 加载匹配结果
      const matchResult = await talentMatchResultRepository.getById(id);
      if (!matchResult) continue;

      // 2. 加载证据链
      const evidence = await matchEvidenceRepository.listByMatchResult(id);
      const evidenceConfValues = evidence.map((e: any) => e.confidence);

      // 3. 加载候选人资料更新时间（用于 Freshness）
      const profile = await prisma.careerProfile.findUnique({
        where: { id: matchResult.profileId },
        select: { updatedAt: true },
      });

      // 4. 计算各维度分数
      const evidenceConfScore = calculateEvidenceConfidence(evidenceConfValues);
      const freshnessScore = profile ? calculateFreshness(profile.updatedAt) : 50;

      // 5. 计算最终排名分数
      const rankingScore = calculateRankingScore(
        matchResult.score,
        evidenceConfScore,
        freshnessScore,
        V1_WEIGHTS,
      );

      rankedResults.push({
        matchResultId: id,
        candidateId: matchResult.candidateId,
        profileId: matchResult.profileId,
        matchScore: matchResult.score,
        rankingScore,
        rank: 0, // 暂时为 0，排序后填充
        rankingVersion: RANKING_VERSION,
        breakdown: {
          matchScore: matchResult.score,
          evidenceConfidence: evidenceConfScore,
          freshness: freshnessScore,
        },
      });
    }

    // 6. 按 rankingScore 降序排序
    rankedResults.sort((a, b) => b.rankingScore - a.rankingScore);

    // 7. 填充 rank（1-based）
    for (let i = 0; i < rankedResults.length; i++) {
      rankedResults[i].rank = i + 1;
    }

    // 8. 回写 rank + rankingVersion 到 DB
    for (const r of rankedResults) {
      await talentMatchResultRepository.updateRank(r.matchResultId, r.rank, r.rankingVersion);
    }

    return rankedResults;
  },

  /**
   * 获取当前排名公式版本
   */
  getVersion(): string {
    return RANKING_VERSION;
  },

  /**
   * 获取当前排名公式权重
   */
  getWeights(): RankingWeights {
    return { ...V1_WEIGHTS };
  },
};
