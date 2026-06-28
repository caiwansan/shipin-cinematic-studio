import { prisma } from '../../../utils/index.js';
import { getDnaByAssetId } from '../asset-dna/dna-generator.js';

export interface SimilarityResult {
  similarityScore: number; // 0.0 ~ 1.0
  inheritedFeatures: string[];
  probableSourceAssets: string[];
}

/**
 * 计算两个资产之间的相似度
 * 使用可选的特征向量做余弦相似度，兜底用 prompt hash 字符串相似度
 */
export async function calculateSimilarity(
  assetId1: string,
  assetId2: string
): Promise<SimilarityResult> {
  try {
    const dna1 = await getDnaByAssetId(assetId1);
    const dna2 = await getDnaByAssetId(assetId2);

    if (!dna1 || !dna2) {
      return { similarityScore: 0, inheritedFeatures: [], probableSourceAssets: [] };
    }

    let scores: number[] = [];
    const inheritedFeatures: string[] = [];

    // 1. 风格向量余弦相似度
    if (dna1.styleVector && dna2.styleVector) {
      try {
        const v1 = JSON.parse(dna1.styleVector) as number[];
        const v2 = JSON.parse(dna2.styleVector) as number[];
        if (Array.isArray(v1) && Array.isArray(v2) && v1.length > 0 && v2.length > 0) {
          const cos = cosineSimilarity(v1, v2);
          scores.push(cos);
          inheritedFeatures.push('style');
        }
      } catch {
        // 解析失败跳过
      }
    }

    // 2. 角色嵌入相似度
    if (dna1.characterEmbedding && dna2.characterEmbedding) {
      try {
        const v1 = JSON.parse(dna1.characterEmbedding) as number[];
        const v2 = JSON.parse(dna2.characterEmbedding) as number[];
        if (Array.isArray(v1) && Array.isArray(v2) && v1.length > 0 && v2.length > 0) {
          const cos = cosineSimilarity(v1, v2);
          scores.push(cos);
          inheritedFeatures.push('character');
        }
      } catch {
        // 跳过
      }
    }

    // 3. 构图向量相似度
    if (dna1.compositionVector && dna2.compositionVector) {
      try {
        const v1 = JSON.parse(dna1.compositionVector) as number[];
        const v2 = JSON.parse(dna2.compositionVector) as number[];
        if (Array.isArray(v1) && Array.isArray(v2) && v1.length > 0 && v2.length > 0) {
          const cos = cosineSimilarity(v1, v2);
          scores.push(cos);
          inheritedFeatures.push('composition');
        }
      } catch {
        // 跳过
      }
    }

    // 4. 色彩分布相似度
    if (dna1.colorDistribution && dna2.colorDistribution) {
      try {
        const v1 = JSON.parse(dna1.colorDistribution) as number[];
        const v2 = JSON.parse(dna2.colorDistribution) as number[];
        if (Array.isArray(v1) && Array.isArray(v2) && v1.length > 0 && v2.length > 0) {
          const cos = cosineSimilarity(v1, v2);
          scores.push(cos);
          inheritedFeatures.push('color');
        }
      } catch {
        // 跳过
      }
    }

    // 5. 兜底：使用 promptStructure hash 做字符串相似度
    if (dna1.promptStructure && dna2.promptStructure) {
      const strSim = stringSimilarity(dna1.promptStructure, dna2.promptStructure);
      scores.push(strSim);
      if (strSim > 0.5) {
        inheritedFeatures.push('prompt');
      }
    }

    // 如果没有有效分数，返回 0
    if (scores.length === 0) {
      // 最后兜底：按 type 是否相同 + 模型是否相同
      let baseScore = 0;
      if (dna1.type === dna2.type) baseScore += 0.2;
      if (dna1.modelInfo && dna2.modelInfo && dna1.modelInfo === dna2.modelInfo) baseScore += 0.1;
      return {
        similarityScore: Math.min(baseScore, 1.0),
        inheritedFeatures: [],
        probableSourceAssets: [],
      };
    }

    // 取平均分作为最终相似度
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const normalizedScore = Math.max(0, Math.min(1, avgScore));

    // 判断可能的来源资产
    const probableSourceAssets: string[] = [];
    if (normalizedScore > 0.7) {
      probableSourceAssets.push(assetId1, assetId2);
    }

    return {
      similarityScore: normalizedScore,
      inheritedFeatures: [...new Set(inheritedFeatures)],
      probableSourceAssets: [...new Set(probableSourceAssets)],
    };
  } catch (error: any) {
    throw new Error(`计算相似度失败: ${error.message}`);
  }
}

/**
 * 查找与给定资产相似度高于阈值的所有资产
 */
export async function findSimilarAssets(
  assetId: string,
  threshold: number = 0.7
): Promise<Array<{ assetId: string; similarityScore: number; inheritedFeatures: string[] }>> {
  try {
    const dna = await getDnaByAssetId(assetId);
    if (!dna) {
      return [];
    }

    // 查找同项目或同类型的 DNA 记录（缩小搜索范围）
    const candidates = await prisma.assetDna.findMany({
      where: {
        AND: [
          { assetId: { not: assetId } },
          {
            OR: [
              { projectId: dna.projectId },
              { type: dna.type },
            ],
          },
        ],
      },
      take: 100,
    });

    const results: Array<{ assetId: string; similarityScore: number; inheritedFeatures: string[] }> = [];

    for (const candidate of candidates) {
      // 跳过自己
      if (candidate.assetId === assetId) continue;

      const sim = await calculateSimilarity(assetId, candidate.assetId);
      if (sim.similarityScore >= threshold) {
        results.push({
          assetId: candidate.assetId,
          similarityScore: sim.similarityScore,
          inheritedFeatures: sim.inheritedFeatures,
        });
      }
    }

    // 按相似度降序排列
    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results;
  } catch (error: any) {
    throw new Error(`查找相似资产失败: ${error.message}`);
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * 计算两个字符串的简单相似度（Dice 系数）
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  // 使用 bigram（2-gram）计算 Dice 系数
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2);
    if (bigramsA.has(bg)) intersection++;
  }

  const totalBigrams = a.length - 1 + b.length - 1;
  if (totalBigrams === 0) return 0;

  return (2.0 * intersection) / totalBigrams;
}
