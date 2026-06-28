import { prisma } from '../../../utils/index.js';

export interface WalletInfo {
  userId: string;
  totalEarned: number;
  totalSpent: number;
  balance: number;
  referenceCount: number;
  reuseCount: number;
}

/**
 * 确保用户钱包存在，不存在则创建
 */
export async function ensureWallet(userId: string): Promise<WalletInfo> {
  try {
    const wallet = await prisma.creatorWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        totalEarned: 0,
        totalSpent: 0,
        balance: 0,
        referenceCount: 0,
        reuseCount: 0,
      },
    });

    return {
      userId: wallet.userId,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      balance: wallet.balance,
      referenceCount: wallet.referenceCount,
      reuseCount: wallet.reuseCount,
    };
  } catch (error: any) {
    throw new Error(`创建/获取钱包失败: ${error.message}`);
  }
}

/**
 * 查询钱包信息
 */
export async function getWallet(userId: string): Promise<WalletInfo | null> {
  try {
    const wallet = await prisma.creatorWallet.findUnique({
      where: { userId },
    });
    if (!wallet) return null;

    return {
      userId: wallet.userId,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      balance: wallet.balance,
      referenceCount: wallet.referenceCount,
      reuseCount: wallet.reuseCount,
    };
  } catch (error: any) {
    throw new Error(`查询钱包失败: ${error.message}`);
  }
}

/**
 * 增加收益（更新 totalEarned + balance）
 */
export async function addEarnings(userId: string, amount: number): Promise<WalletInfo> {
  try {
    const wallet = await prisma.creatorWallet.upsert({
      where: { userId },
      update: {
        totalEarned: { increment: amount },
        balance: { increment: amount },
      },
      create: {
        userId,
        totalEarned: amount,
        totalSpent: 0,
        balance: amount,
        referenceCount: 0,
        reuseCount: 0,
      },
    });

    return {
      userId: wallet.userId,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      balance: wallet.balance,
      referenceCount: wallet.referenceCount,
      reuseCount: wallet.reuseCount,
    };
  } catch (error: any) {
    throw new Error(`增加收益失败: ${error.message}`);
  }
}

/**
 * 支出积分（更新 totalSpent + 减少 balance）
 */
export async function spendCoins(userId: string, amount: number): Promise<WalletInfo> {
  try {
    // 先查询钱包余额
    const existing = await prisma.creatorWallet.findUnique({
      where: { userId },
    });

    if (!existing || existing.balance < amount) {
      throw new Error(`余额不足，需要 ${amount} 积分，当前余额 ${existing?.balance ?? 0}`);
    }

    const wallet = await prisma.creatorWallet.update({
      where: { userId },
      data: {
        totalSpent: { increment: amount },
        balance: { increment: -amount },
      },
    });

    return {
      userId: wallet.userId,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      balance: wallet.balance,
      referenceCount: wallet.referenceCount,
      reuseCount: wallet.reuseCount,
    };
  } catch (error: any) {
    throw new Error(`支出积分失败: ${error.message}`);
  }
}

/**
 * 获取钱包交易流水
 */
export async function getStatement(userId: string, limit: number = 20) {
  try {
    const transactions = await prisma.assetTransaction.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions;
  } catch (error: any) {
    throw new Error(`查询交易记录失败: ${error.message}`);
  }
}

/**
 * 增加引用计数
 */
export async function incrementReferenceCount(userId: string) {
  try {
    await prisma.creatorWallet.upsert({
      where: { userId },
      update: { referenceCount: { increment: 1 } },
      create: {
        userId,
        totalEarned: 0,
        totalSpent: 0,
        balance: 0,
        referenceCount: 1,
        reuseCount: 0,
      },
    });
  } catch (error: any) {
    throw new Error(`更新引用计数失败: ${error.message}`);
  }
}

/**
 * 增加复用计数
 */
export async function incrementReuseCount(userId: string) {
  try {
    await prisma.creatorWallet.upsert({
      where: { userId },
      update: { reuseCount: { increment: 1 } },
      create: {
        userId,
        totalEarned: 0,
        totalSpent: 0,
        balance: 0,
        referenceCount: 0,
        reuseCount: 1,
      },
    });
  } catch (error: any) {
    throw new Error(`更新复用计数失败: ${error.message}`);
  }
}
