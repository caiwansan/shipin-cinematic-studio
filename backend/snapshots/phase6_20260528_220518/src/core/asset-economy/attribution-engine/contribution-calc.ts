import { prisma } from '../../../utils/index.js';
import { getLineageNode } from '../lineage-engine/lineage-tracker.js';

export interface ContributionResult {
  creatorId: string;
  contributionScore: number; // 0.0 ~ 1.0
  inheritedWeight: number;
  role: string | null;
}

/**
 * 计算资产中每个创作者的贡献比例
 * 使用线性衰减模型：最深祖辈贡献最低，最近改编者贡献最高
 */
export async function calculateContributions(assetId: string): Promise<ContributionResult[]> {
  try {
    const lineage = await getLineageNode(assetId);
    if (!lineage) {
      // 没有血缘信息，默认当前用户 100%
      return [];
    }

    const { creatorChain, lineageDepth } = lineage;

    if (!creatorChain || creatorChain.length === 0) {
      return [];
    }

    // 线性衰减模型：每个深度 level 的贡献
    // 最深祖辈（depth=0）权重最低，当前层（depth=maxDepth）权重最高
    const maxDepth = Math.max(...creatorChain.map(c => c.depth), lineageDepth);
    const totalWeight = creatorChain.reduce((sum, c) => sum + (c.depth + 1), 0);

    const results: ContributionResult[] = creatorChain.map(entry => {
      const rawWeight = (entry.depth + 1) / totalWeight;

      return {
        creatorId: entry.creatorId,
        contributionScore: rawWeight,
        inheritedWeight: maxDepth > 0 ? entry.depth / maxDepth : 0,
        role: null,
      };
    });

    // 归一化
    const totalScore = results.reduce((sum, r) => sum + r.contributionScore, 0);
    const normalized = results.map(r => ({
      ...r,
      contributionScore: totalScore > 0 ? r.contributionScore / totalScore : 0,
    }));

    // 保存到数据库
    // 先删除旧记录
    await prisma.contributionWeight.deleteMany({
      where: { assetId },
    });

    // 批量创建
    for (const entry of normalized) {
      await prisma.contributionWeight.create({
        data: {
          assetId,
          creatorId: entry.creatorId,
          contributionScore: entry.contributionScore,
          inheritedWeight: entry.inheritedWeight,
          role: entry.role,
        },
      });
    }

    return normalized;
  } catch (error: any) {
    throw new Error(`计算贡献度失败: ${error.message}`);
  }
}

/**
 * 获取资产的贡献度列表（从数据库读取）
 */
export async function getContributions(assetId: string): Promise<ContributionResult[]> {
  try {
    const weights = await prisma.contributionWeight.findMany({
      where: { assetId },
      orderBy: { contributionScore: 'desc' },
    });

    return weights.map(w => ({
      creatorId: w.creatorId,
      contributionScore: w.contributionScore,
      inheritedWeight: w.inheritedWeight,
      role: w.role,
    }));
  } catch (error: any) {
    throw new Error(`获取贡献度失败: ${error.message}`);
  }
}
