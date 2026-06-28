import { FastifyInstance } from 'fastify';
import { getDnaByAssetId, generateAssetDna } from '../asset-dna/dna-generator.js';
import { getLineageTree, trackLineage } from '../lineage-engine/lineage-tracker.js';
import { findSimilarAssets, calculateSimilarity } from '../similarity-engine/similarity-scorer.js';
import { calculateContributions, getContributions } from '../attribution-engine/contribution-calc.js';
import { splitRevenue, calculateUsageCost } from '../revenue-engine/revenue-splitter.js';
import { ensureWallet, getWallet, getStatement } from '../creator-wallet/wallet-manager.js';
import { logTransaction, getTransactions } from '../transaction-engine/transaction-logger.js';
import { submitForReview, getPendingQueue, review as reviewAction } from '../moderation/review-queue.js';
import { buildAssetGraph } from '../asset-graph/graph-builder.js';
import { prisma } from '../../../utils/index.js';

export default async function assetEconomyRoutes(app: FastifyInstance) {
  const prefix = '/api/v1/asset-economy';

  // ============================================================
  // DNA
  // ============================================================
  app.get(`${prefix}/asset/:assetId/dna`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const dna = await getDnaByAssetId(assetId);
      if (!dna) {
        return reply.status(404).send({ error: '资产 DNA 不存在' });
      }
      return dna;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Lineage
  // ============================================================
  app.get(`${prefix}/asset/:assetId/lineage`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const tree = await getLineageTree(assetId);
      return tree;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Similar Assets
  // ============================================================
  app.get(`${prefix}/asset/:assetId/similar`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const query = request.query as { threshold?: string };
      const threshold = query.threshold ? parseFloat(query.threshold) : 0.7;
      const similar = await findSimilarAssets(assetId, threshold);
      return { assetId, threshold, similar };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Contributions
  // ============================================================
  app.get(`${prefix}/asset/:assetId/contributions`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      // 先尝试获取已有贡献度，如果没有则计算
      let contributions = await getContributions(assetId);
      if (contributions.length === 0) {
        contributions = await calculateContributions(assetId);
      }
      return { assetId, contributions };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Reference Asset (引用资产并扣积分)
  // ============================================================
  app.post(`${prefix}/asset/:assetId/reference`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const body = request.body as {
        userId: string;
        targetProjectId: string;
        referenceType?: string;
        coinsAmount?: number;
        parentAssetIds?: string[];
      };

      if (!body.userId) {
        return reply.status(400).send({ error: '缺少 userId' });
      }

      const referenceType = body.referenceType || 'direct';
      let coinsAmount = body.coinsAmount;

      // 如果没有指定积分，自动计算成本
      if (!coinsAmount) {
        const parentIds = body.parentAssetIds || [assetId];
        coinsAmount = await calculateUsageCost(parentIds);
      }

      // 执行交易
      const tx = await logTransaction({
        fromUserId: body.userId,
        assetId,
        projectId: body.targetProjectId,
        transactionType: 'reference',
        coinsAmount,
      });

      // 记录引用关系
      await prisma.assetReference.create({
        data: {
          sourceAssetId: assetId,
          targetAssetId: body.targetProjectId || `derived-${Date.now()}`,
          userId: body.userId,
          projectId: body.targetProjectId,
          referenceType,
          coinsPaid: coinsAmount,
        },
      });

      // 如果有父资产，追踪血缘
      if (body.parentAssetIds && body.parentAssetIds.length > 0) {
        await trackLineage(assetId, body.parentAssetIds, body.userId);
      }

      return {
        transaction: tx,
        coinsSpent: coinsAmount,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Wallet
  // ============================================================
  app.get(`${prefix}/wallet/:userId`, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      let wallet = await getWallet(userId);
      if (!wallet) {
        wallet = await ensureWallet(userId);
      }
      return wallet;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Wallet Statement
  // ============================================================
  app.get(`${prefix}/wallet/:userId/statement`, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit) : 20;
      const txs = await getStatement(userId, limit);
      return { userId, transactions: txs };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Asset Transactions
  // ============================================================
  app.get(`${prefix}/asset/:assetId/transactions`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const txs = await getTransactions(assetId);
      return { assetId, transactions: txs };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Moderation Queue (Admin)
  // ============================================================
  app.get(`${prefix}/moderation/queue`, async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit) : 20;
      const queue = await getPendingQueue(limit);
      return { queue };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  app.put(`${prefix}/moderation/:id/review`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { reviewerId: string; status: 'cleared' | 'flagged' };

      if (!body.reviewerId || !body.status) {
        return reply.status(400).send({ error: '缺少 reviewerId 或 status' });
      }

      const result = await reviewAction(id, body.reviewerId, body.status);
      return result;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Asset Graph
  // ============================================================
  app.get(`${prefix}/asset/:assetId/graph`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const graph = await buildAssetGraph(assetId);
      return graph;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Revenue Split (Admin / Manual trigger)
  // ============================================================
  app.post(`${prefix}/asset/:assetId/split-revenue`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const body = request.body as { totalCoins: number };

      if (!body.totalCoins || body.totalCoins <= 0) {
        return reply.status(400).send({ error: '缺少有效的 totalCoins' });
      }

      const result = await splitRevenue(assetId, body.totalCoins);
      return result;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Generate Asset DNA (创建资产时调用)
  // ============================================================
  app.post(`${prefix}/asset/:assetId/generate-dna`, async (request, reply) => {
    try {
      const { assetId } = request.params as { assetId: string };
      const body = request.body as {
        creatorId: string;
        projectId: string;
        type: string;
        metadata?: Record<string, any>;
      };

      if (!body.creatorId || !body.projectId || !body.type) {
        return reply.status(400).send({ error: '缺少 creatorId/projectId/type' });
      }

      const dna = await generateAssetDna(
        assetId,
        body.creatorId,
        body.projectId,
        body.type,
        body.metadata
      );
      return dna;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ============================================================
  // Creator Rankings (for 作品宇宙 leaderboard)
  // ============================================================
  app.get(`${prefix}/creators/top`, async (request, reply) => {
    try {
      // 创作者排行榜：按被引用总数排名
      const topCreators = await prisma.assetReference.groupBy({
        by: ['userId'],
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      })
      const userIds = topCreators.map(c => c.userId)
      const users = userIds.length > 0
        ? await prisma.membership.findMany({
            where: { userId: { in: userIds } },
            include: { user: { select: { id: true, username: true } } },
          })
        : []
      const userMap = new Map(users.map(u => [u.userId, u.user?.username || '匿名']))

      return topCreators.map((c, i) => ({
        rank: i + 1,
        userId: c.userId,
        username: userMap.get(c.userId) || '匿名',
        referenceCount: c._count.userId,
      }))
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })

  app.get(`${prefix}/creators/earnings-ranking`, async (request, reply) => {
    try {
      // 收益排行榜：按钱包积分余额排名
      const wallets = await prisma.creatorWallet.findMany({
        orderBy: { balance: 'desc' },
        take: 10,
      })
      // 通过 memberships 关联用户
      const userIds = wallets.map(w => w.userId)
      const memberships = userIds.length > 0
        ? await prisma.membership.findMany({
            where: { userId: { in: userIds } },
            include: { user: { select: { id: true, username: true } } },
          })
        : []
      const userMap = new Map(memberships.map(m => [m.userId, m.user?.username || '匿名']))

      return wallets.map((w, i) => ({
        rank: i + 1,
        userId: w.userId,
        username: userMap.get(w.userId) || '匿名',
        earnings: w.balance,
      }))
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })
}
