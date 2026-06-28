import { prisma } from '../../../utils/index.js';
import { splitRevenue } from '../revenue-engine/revenue-splitter.js';
import { ensureWallet, spendCoins, addEarnings } from '../creator-wallet/wallet-manager.js';

export interface TransactionParams {
  fromUserId?: string;
  toUserId?: string;
  assetId: string;
  projectId?: string;
  transactionType: string;
  coinsAmount: number;
  platformFee?: number;
  status?: string;
}

export interface TransactionResult {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  assetId: string;
  projectId: string | null;
  transactionType: string;
  coinsAmount: number;
  platformFee: number;
  status: string;
  createdAt: Date;
}

/**
 * 记录交易并处理分账
 */
export async function logTransaction(params: TransactionParams): Promise<TransactionResult> {
  try {
    const platformFee = params.platformFee ?? Math.floor(params.coinsAmount * 0.1);

    // 确保涉及的用户钱包存在
    if (params.fromUserId) await ensureWallet(params.fromUserId);
    if (params.toUserId) await ensureWallet(params.toUserId);

    // 从支付方扣除积分
    if (params.fromUserId) {
      await spendCoins(params.fromUserId, params.coinsAmount);
    }

    // 创建交易记录
    const tx = await prisma.assetTransaction.create({
      data: {
        fromUserId: params.fromUserId ?? null,
        toUserId: params.toUserId ?? null,
        assetId: params.assetId,
        projectId: params.projectId ?? null,
        transactionType: params.transactionType,
        coinsAmount: params.coinsAmount,
        platformFee,
        status: params.status ?? 'completed',
      },
    });

    // 如果是引用/复用类型，自动触发收益分账
    if (params.transactionType === 'reference' || params.transactionType === 'reuse') {
      // 净额（扣除平台抽成后）按贡献度分给创作者
      try {
        await splitRevenue(params.assetId, params.coinsAmount);
      } catch (splitError: any) {
        console.warn(`[transaction-logger] 收益分账失败（不影响交易记录）: ${splitError.message}`);
      }

      // 如果接收方明确指定，直接转给接收方
      if (params.toUserId) {
        await addEarnings(params.toUserId, params.coinsAmount - platformFee);
      }
    }

    return {
      id: tx.id,
      fromUserId: tx.fromUserId,
      toUserId: tx.toUserId,
      assetId: tx.assetId,
      projectId: tx.projectId,
      transactionType: tx.transactionType,
      coinsAmount: tx.coinsAmount,
      platformFee: tx.platformFee,
      status: tx.status,
      createdAt: tx.createdAt,
    };
  } catch (error: any) {
    throw new Error(`记录交易失败: ${error.message}`);
  }
}

/**
 * 查询某资产的所有交易记录
 */
export async function getTransactions(assetId: string): Promise<TransactionResult[]> {
  try {
    const txs = await prisma.assetTransaction.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });

    return txs.map(tx => ({
      id: tx.id,
      fromUserId: tx.fromUserId,
      toUserId: tx.toUserId,
      assetId: tx.assetId,
      projectId: tx.projectId,
      transactionType: tx.transactionType,
      coinsAmount: tx.coinsAmount,
      platformFee: tx.platformFee,
      status: tx.status,
      createdAt: tx.createdAt,
    }));
  } catch (error: any) {
    throw new Error(`查询交易记录失败: ${error.message}`);
  }
}
