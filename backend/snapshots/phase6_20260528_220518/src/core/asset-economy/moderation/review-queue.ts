import { prisma } from '../../../utils/index.js';
import { findSimilarAssets } from '../similarity-engine/similarity-scorer.js';

export interface ReviewItem {
  id: string;
  assetId: string;
  reason: string;
  similarityScore: number | null;
  reportedBy: string | null;
  status: string;
  reviewerId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

/**
 * 提交资产到审核队列
 */
export async function submitForReview(
  assetId: string,
  reason: string,
  score?: number,
  reportedBy?: string
): Promise<ReviewItem> {
  try {
    const item = await prisma.moderationQueue.create({
      data: {
        assetId,
        reason,
        similarityScore: score ?? null,
        reportedBy: reportedBy ?? null,
        status: 'pending',
      },
    });

    return item;
  } catch (error: any) {
    throw new Error(`提交审核失败: ${error.message}`);
  }
}

/**
 * 审核操作（通过/标记/清除）
 */
export async function review(
  reviewId: string,
  reviewerId: string,
  status: 'cleared' | 'flagged'
): Promise<ReviewItem> {
  try {
    const item = await prisma.moderationQueue.update({
      where: { id: reviewId },
      data: {
        status,
        reviewerId,
        reviewedAt: new Date(),
      },
    });

    return item;
  } catch (error: any) {
    throw new Error(`审核操作失败: ${error.message}`);
  }
}

/**
 * 获取待审核队列
 */
export async function getPendingQueue(limit: number = 20): Promise<ReviewItem[]> {
  try {
    const items = await prisma.moderationQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return items;
  } catch (error: any) {
    throw new Error(`获取审核队列失败: ${error.message}`);
  }
}

/**
 * 自动检测高相似度资产并加入审核队列
 */
export async function autoDetectHighSimilarity(
  assetId: string,
  threshold: number = 0.8
): Promise<ReviewItem[]> {
  try {
    const similarAssets = await findSimilarAssets(assetId, threshold);
    const createdItems: ReviewItem[] = [];

    for (const similar of similarAssets) {
      // 检查是否已经有过审核记录
      const existing = await prisma.moderationQueue.findFirst({
        where: {
          assetId: similar.assetId,
          status: { in: ['pending', 'reviewed'] },
        },
      });

      if (existing) continue;

      const item = await submitForReview(
        similar.assetId,
        'high_similarity',
        similar.similarityScore,
        'system'
      );
      createdItems.push(item);
    }

    return createdItems;
  } catch (error: any) {
    throw new Error(`自动检测高相似资产失败: ${error.message}`);
  }
}
