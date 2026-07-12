// ============================================================
// Review API Handler — 审核 API 编排
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { reviewQueue } from './queue';
import { candidateStore } from '../candidate/store';
import type { CandidateReview } from '../types';

export const reviewApi = {
  /**
   * 获取 Review Queue 概览
   */
  getQueueOverview: () => {
    const pending = reviewQueue.getPending();
    return {
      totalPending: pending.length,
      newItems: pending.filter(c => c.status === 'new').length,
      reviewingItems: pending.filter(c => c.status === 'reviewing').length,
      items: pending,
    };
  },

  /**
   * 开始审核一个 Candidate
   */
  beginReview: (candidateId: string) => {
    const candidate = candidateStore.getById(candidateId);
    if (!candidate) return null;

    // 只有 'new' 状态的可以开始审核
    if (candidate.status !== 'new') {
      return { error: `Candidate 状态为 ${candidate.status}，不能开始审核` };
    }

    return reviewQueue.startReview(candidateId);
  },

  /**
   * 提交审核结果
   */
  submitReview: (
    candidateId: string,
    action: 'approve' | 'reject',
    comment: string
  ) => {
    const candidate = candidateStore.getById(candidateId);
    if (!candidate) {
      return { error: 'Candidate not found' };
    }
    if (candidate.status === 'golden') {
      return { error: 'Candidate 已经是 Golden，不能修改' };
    }

    const review: Omit<CandidateReview, 'reviewId' | 'timestamp'> = {
      candidateId,
      reviewer: 'default',
      action,
      comment: comment || '',
    };

    return reviewQueue.completeReview(candidateId, review);
  },
};
