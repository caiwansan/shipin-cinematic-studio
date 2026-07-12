// ============================================================
// Knowledge Evolution Layer v1.0 — Types
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

/** Candidate 状态 */
export type CandidateStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'golden';

/** ReplayCandidate 模型 */
export interface ReplayCandidate {
  candidateId: string;              // 唯一标识
  replayId: string;                // 关联的 Replay
  provider: string;                // 来源 Provider
  providerVersion: string;         // Provider 版本（model 名）
  score: number;                   // Overall 评分
  band: string;                    // Band 等级
  confidence: number;              // Confidence 值
  evidenceScore: number;           // Evidence 质量评分
  status: CandidateStatus;         // 当前状态
  reason: string;                  // 为什么成为 Candidate
  categories: string[];            // 分类标签（industry/scenario）
  meta: Record<string, any>;       // 扩展元数据
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
}

/** Review 记录 */
export interface CandidateReview {
  reviewId: string;
  candidateId: string;
  reviewer: string;                // 审核人（当前硬编码 default）
  action: 'approve' | 'reject' | 'request_changes';
  comment: string;
  timestamp: string;
}

/** Promotion Log */
export interface PromotionLog {
  promotionId: string;
  candidateId: string;
  replayId: string;
  goldenVersion: string;           // 晋升后的 Dataset 版本号
  promotedAt: string;
  snapshotBefore: string;
  snapshotAfter: string;
}

/** Candidate 生成阈值配置（可外部化） */
export interface CandidateThresholds {
  minScore: number;          // Overall 评分阈值
  minConfidence: number;     // Confidence 阈值
  minEvidenceScore: number;  // Evidence 质量阈值
}

/** 默认阈值 */
export const DEFAULT_CANDIDATE_THRESHOLDS: CandidateThresholds = {
  minScore: 70,
  minConfidence: 0.5,
  minEvidenceScore: 50,
};
