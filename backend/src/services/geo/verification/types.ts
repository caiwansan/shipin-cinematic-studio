// ============================================================
// P0-T006: Verification MVP — Core Types
// ============================================================

export interface VerificationResult {
  id: string;
  projectId: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'INCONCLUSIVE';
  confidence: number;       // 0-100

  // Before/After
  before: {
    adi: number;
    aiPresenceScore: number;
    visibilityCount: number;
    averageKnowledge: number;
    evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
    checkedAt: string;
  };
  after: {
    adi: number;
    aiPresenceScore: number;
    visibilityCount: number;
    averageKnowledge: number;
    evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
    checkedAt: string;
  };
  delta: {
    adi: number;              // after - before
    aiPresenceScore: number;
    visibilityCount: number;
    averageKnowledge: number;
    evidenceGradeDelta: number; // 等级差值（A=4, B=3, C=2, D=1）
  };

  claims: VerificationClaim[];
  evidence: VerificationEvidence[];
  explain: {
    summary: string;
    confidence: number;
    reasons: Array<{ code: string; message: string }>;
    limitations: string[];
  };
  recommendations: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
    reason: string;
  }>;

  createdAt: string;
  projectSnapshotId?: string;  // 指向优化前的快照
}

export interface VerificationClaim {
  id: string;
  type: 'improvement' | 'regression' | 'unchanged';
  metric: string;           // 如 'ADI', 'AI Presence Score'
  beforeValue: number;
  afterValue: number;
  delta: number;
  summary: string;          // 如 "ADI 提升 +8"
  evidence: string[];       // evidence IDs
  confidence: number;
}

export interface VerificationEvidence {
  id: string;
  type: 'claim_result' | 'snapshot' | 'ai_presence' | 'optimization';
  source: string;
  content: string;
  timestamp: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface VerificationHistoryEntry {
  id: string;
  projectId: string;
  status: string;
  confidence: number;
  adiDelta: number;
  createdAt: string;
}

export interface VerificationRunRequest {
  projectId: string;
  // 如果没有传 beforeSnapshotId，引擎会自动从 project 的当前 ADI 开始
  beforeSnapshotId?: string;
}

// 证据等级转数值
export function evidenceGradeToNumber(grade: 'A' | 'B' | 'C' | 'D' | 'N/A'): number {
  const map: Record<string, number> = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'N/A': 0 };
  return map[grade] ?? 0;
}

// 数值转证据等级
export function numberToEvidenceGrade(n: number): 'A' | 'B' | 'C' | 'D' | 'N/A' {
  if (n >= 4) return 'A';
  if (n >= 3) return 'B';
  if (n >= 2) return 'C';
  if (n >= 1) return 'D';
  return 'N/A';
}

// 生成唯一 ID
export function generateVerificationId(): string {
  return `ver-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateClaimId(): string {
  return `clm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export function generateEvidenceId(): string {
  return `evd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
