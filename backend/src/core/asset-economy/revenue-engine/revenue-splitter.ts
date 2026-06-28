import { prisma } from '../../../utils/index.js';
import { calculateContributions, getContributions, ContributionResult } from '../attribution-engine/contribution-calc.js';
import { ensureWallet, addEarnings } from '../creator-wallet/wallet-manager.js';

export interface RevenueSplitResult {
  transactionId: string;
  splits: Array<{
    creatorId: string;
    amount: number;
    percentage: number;
    role: string;
  }>;
}

/**
 * 按贡献度分账
 * 平台抽成 10%，剩余 90% 按贡献度比例分配
 */
export async function splitRevenue(
  assetId: string,
  totalCoins: number
): Promise<RevenueSplitResult> {
  try {
    // 获取或计算贡献度
    let contributions: ContributionResult[] = await getContributions(assetId);
    if (contributions.length === 0) {
      // 如果尚未计算，则计算
      contributions = await calculateContributions(assetId);
    }
    if (contributions.length === 0) {
      throw new Error(`资产 ${assetId} 没有贡献度信息，无法分账`);
    }

    // 平台抽成 10%
    const platformFee = Math.floor(totalCoins * 0.1);
    const distributable = totalCoins - platformFee;

    // 创建一条虚拟交易记录用于分账关联
    const tx = await prisma.assetTransaction.create({
      data: {
        assetId,
        transactionType: 'revenue_split',
        coinsAmount: totalCoins,
        platformFee,
        status: 'completed',
      },
    });

    const splits: RevenueSplitResult['splits'] = [];

    for (const contrib of contributions) {
      const share = Math.floor(distributable * contrib.contributionScore);
      if (share <= 0) continue;

      // 确定角色
      const role = contrib.role || (contrib.inheritedWeight > 0 ? 'derivative' : 'original');

      // 创建分账记录
      await prisma.revenueSplit.create({
        data: {
          transactionId: tx.id,
          creatorId: contrib.creatorId,
          assetId,
          amount: share,
          percentage: contrib.contributionScore,
          role,
        },
      });

      // 更新创作者钱包
      await addEarnings(contrib.creatorId, share);

      splits.push({
        creatorId: contrib.creatorId,
        amount: share,
        percentage: contrib.contributionScore,
        role,
      });
    }

    return {
      transactionId: tx.id,
      splits,
    };
  } catch (error: any) {
    throw new Error(`收益分账失败: ${error.message}`);
  }
}

/**
 * 计算引用资产需要支付的积分
 * 按引用资产的引用次数（热度）+ 质量权重估算
 */
export async function calculateUsageCost(
  sourceAssetIds: string[]
): Promise<number> {
  try {
    if (sourceAssetIds.length === 0) return 0;

    let totalCost = 0;

    for (const assetId of sourceAssetIds) {
      // 基础成本
      let baseCost = 10;

      // 查看被引用次数
      const refCount = await prisma.assetReference.count({
        where: { sourceAssetId: assetId },
      });

      // 引用次数越多，成本越高（热度溢价）
      const heatMultiplier = Math.min(1 + refCount * 0.1, 3.0);

      // 检查是否有 DNA 信息（有 DNA 的是平台原生资产，价值更高）
      const dna = await prisma.assetDna.findUnique({
        where: { assetId },
      });

      const typeMultiplier = dna ? 1.5 : 1.0;

      totalCost += Math.floor(baseCost * heatMultiplier * typeMultiplier);
    }

    return totalCost;
  } catch (error: any) {
    throw new Error(`计算引用成本失败: ${error.message}`);
  }
}
