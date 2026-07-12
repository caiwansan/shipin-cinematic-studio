// ============================================================
// Dashboard Stats — Learning Dashboard 统计数据
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { candidateStore } from '../candidate/store';
import { promotionEngine } from '../promotion/engine';

export const learningDashboard = {
  summary: () => {
    const stats = candidateStore.getStats();
    const logs = promotionEngine.getLogs();
    const recentPromotions = logs.slice(0, 5);

    return {
      stats: {
        ...stats,
        goldenVersion: promotionEngine.getCurrentVersion(),
        totalPromotions: logs.length,
      },
      recentPromotions,
    };
  },
};
