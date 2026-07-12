// ============================================================
// Golden Promotion Engine — 晋升 Candidate → Golden Dataset
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { candidateStore } from '../candidate/store';
import type { PromotionLog } from '../types';

// Promotion Log（in-memory，后续可持久化）
const promotionLogs: PromotionLog[] = [];

// 当前 Golden Dataset 版本（每次 promotion 递增）
let currentGoldenVersion = 'v1.1';

export const promotionEngine = {
  /**
   * 晋升 Candidate 到 Golden Dataset
   * 只有 'approved' 状态的 Candidate 才能晋升
   */
  promote: (candidateId: string): PromotionLog | null => {
    const candidate = candidateStore.getById(candidateId);
    if (!candidate || candidate.status !== 'approved') {
      return null;  // 只有 approved 状态才能晋升
    }

    // 版本递增
    const parts = currentGoldenVersion.match(/v(\d+)\.(\d+)/);
    if (parts) {
      const major = parseInt(parts[1]);
      const minor = parseInt(parts[2]) + 1;
      currentGoldenVersion = `v${major}.${minor}`;
    }

    const log: PromotionLog = {
      promotionId: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      candidateId,
      replayId: candidate.replayId,
      goldenVersion: currentGoldenVersion,
      promotedAt: new Date().toISOString(),
      snapshotBefore: candidate.meta?.snapshotHash || 'unknown',
      snapshotAfter: candidate.meta?.snapshotHash || 'unknown',
    };

    promotionLogs.push(log);

    // 更新 Candidate 状态为 golden
    candidateStore.updateStatus(candidateId, 'golden');

    // CI Validation 将在后续版本集成
    // triggerValidation(currentGoldenVersion);

    return log;
  },

  /**
   * 获取 Promotion 历史（按时间降序）
   */
  getLogs: (): PromotionLog[] => {
    return [...promotionLogs].sort((a, b) =>
      new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime()
    );
  },

  /**
   * 获取当前 Golden Dataset 版本号
   */
  getCurrentVersion: (): string => currentGoldenVersion,
};
