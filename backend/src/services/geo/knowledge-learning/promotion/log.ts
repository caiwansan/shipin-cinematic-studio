// ============================================================
// Promotion Log — 晋升审计日志
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { promotionEngine } from './engine';

/**
 * Promotion Log 审计查询工具
 */
export const promotionLogExplorer = {
  /**
   * 查询一次晋升的完整溯源信息
   */
  tracePromotion: (promotionId: string) => {
    const logs = promotionEngine.getLogs();
    return logs.find(l => l.promotionId === promotionId) || null;
  },

  /**
   * 按 Candidate 查询晋升记录
   */
  findByCandidateId: (candidateId: string) => {
    const logs = promotionEngine.getLogs();
    return logs.filter(l => l.candidateId === candidateId);
  },

  /**
   * Golden Dataset 各版本摘要
   */
  versionHistory: () => {
    const logs = promotionEngine.getLogs();
    return logs.map(l => ({
      version: l.goldenVersion,
      promotedAt: l.promotedAt,
      replayId: l.replayId,
    }));
  },
};
