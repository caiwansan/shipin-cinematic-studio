// ============================================================
// Review Queue — 审核队列管理
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { candidateStore } from '../candidate/store';
import type { ReplayCandidate, CandidateReview } from '../types';

export const reviewQueue = {
  /**
   * 获取所有待审核的 Candidate（按时间排序，最新优先）
   */
  getPending: (): ReplayCandidate[] => {
    return candidateStore.getAll('new')
      .concat(candidateStore.getAll('reviewing'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * 标记为 reviewing（防止多人在纯内存模式下争抢）
   */
  startReview: (candidateId: string): ReplayCandidate | undefined => {
    return candidateStore.updateStatus(candidateId, 'reviewing');
  },

  /**
   * 完成审核
   */
  completeReview: (
    candidateId: string,
    review: Omit<CandidateReview, 'reviewId' | 'timestamp'>
  ): ReplayCandidate | undefined => {
    const entry = candidateStore.getById(candidateId);
    if (!entry) return undefined;

    const newStatus = review.action === 'approve' ? 'approved' : 'rejected';
    const updated = candidateStore.updateStatus(candidateId, newStatus);
    return updated;
  },
};
