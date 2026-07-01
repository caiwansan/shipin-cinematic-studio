// ============================================================
// UserProgressRepository — 持久化 Walkthrough 状态
// RC1-T003 — 唯一数据层，禁止直接操作 localStorage
// SSOT: WalkthroughProgress 表
// ============================================================

import { prisma } from '../../../utils/index.js';

interface WalkthroughProgress {
  id: string;
  userId: string;
  currentStep: string;
  dismissed: boolean;
  completed: boolean;
  lastSeenAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

export class UserProgressRepository {
  /**
   * 按 userId 查找进度
   */
  async findByUserId(userId: string): Promise<WalkthroughProgress | null> {
    const record = await prisma.walkthroughProgress.findUnique({
      where: { userId },
    });
    if (!record) return null;
    return record as WalkthroughProgress;
  }

  /**
   * 创建或更新进度
   */
  async upsert(
    userId: string,
    data: Partial<WalkthroughProgress>,
  ): Promise<WalkthroughProgress> {
    const record = await prisma.walkthroughProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: data.currentStep ?? 'welcome',
        dismissed: data.dismissed ?? false,
        completed: data.completed ?? false,
        lastSeenAt: new Date(),
      },
      update: {
        ...(data.currentStep !== undefined ? { currentStep: data.currentStep } : {}),
        ...(data.dismissed !== undefined ? { dismissed: data.dismissed } : {}),
        ...(data.completed !== undefined ? { completed: data.completed } : {}),
        lastSeenAt: new Date(),
      },
    });
    return record as WalkthroughProgress;
  }

  /**
   * 标记为已关闭
   */
  async markDismissed(userId: string): Promise<void> {
    await prisma.walkthroughProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: 'welcome',
        dismissed: true,
        completed: false,
        lastSeenAt: new Date(),
      },
      update: {
        dismissed: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * 标记为已完成
   */
  async markCompleted(userId: string): Promise<void> {
    await prisma.walkthroughProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: 'verification',
        dismissed: false,
        completed: true,
        lastSeenAt: new Date(),
      },
      update: {
        currentStep: 'verification',
        completed: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * 重新开始
   */
  async restart(userId: string): Promise<WalkthroughProgress> {
    const record = await prisma.walkthroughProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: 'welcome',
        dismissed: false,
        completed: false,
        lastSeenAt: new Date(),
      },
      update: {
        currentStep: 'welcome',
        dismissed: false,
        completed: false,
        lastSeenAt: new Date(),
      },
    });
    return record as WalkthroughProgress;
  }
}
