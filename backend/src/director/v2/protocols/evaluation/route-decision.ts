// ============================================================================
// RouteDecision — Evaluation Protocol (Chapter ⑪)
//
// Evaluation Engine's sole output. Consumed by Recovery Router.
// Evaluation never calls recover/resolve/replan — it only emits RouteDecision.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { RecoveryActionId, RecoveryScope } from '../recovery/recovery-action';

// ── Route Decision Type ──────────────────────────────────────────────────────

export enum RouteDecisionType {
  /** Protocol compliance passed, quality ≥ 85 — proceed to generation */
  PASS = 'PASS',
  /** Quality 50–85, recovery confidence ≥ 0.3 — route to Recovery Router */
  AUTO_RECOVER = 'AUTO_RECOVER',
  /** Recovery confidence < 0.3 on critical dimensions — escalate to human */
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  /** Quality < 50 — segment needs full re-plan */
  FULL_REPLAN = 'FULL_REPLAN',
  /** Protocol compliance check failed — do not proceed */
  ARCHITECTURE_FAIL = 'ARCHITECTURE_FAIL',
}

// ── Protocol Compliance ──────────────────────────────────────────────────────

export interface ProtocolComplianceReport {
  principles: Array<{
    principle: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    evidence: string;
  }>;
  overall: 'PASS' | 'FAIL';
}

// ── Protocol Score (Tier 1) ──────────────────────────────────────────────────

export interface ProtocolScoreAttribution {
  source: string;
  impact: number;  // negative points deducted
  description: string;
  linkedRecoveryActionId?: RecoveryActionId;
}

export interface ProtocolScore {
  protocol: string;
  rawScore: number;             // 0–100 per protocol
  weight: number;               // 0.0–0.2
  weightedScore: number;        // rawScore * weight
  attribution: ProtocolScoreAttribution[];
}

// ── Business Score (Tier 2) ──────────────────────────────────────────────────

export interface BusinessScoreAttribution {
  protocolAttribution: string;  // "Reference" | "Constraint" | etc.
  source: string;
  impact: number;
  description: string;
  linkedConstraintId?: string;
  linkedRecoveryActionId?: RecoveryActionId;
}

export interface BusinessScoreDimension {
  name: string;
  label: string;
  weight: number;
  score: number;                // 0–100 raw
  weighted: number;             // score * weight
  attribution: BusinessScoreAttribution[];
}

export interface BusinessScore {
  dimensions: BusinessScoreDimension[];
  totalWeightedScore: number;   // 0–100
}

// ── Quality Trend ────────────────────────────────────────────────────────────

export interface QualityTrend {
  history: Array<{
    runNumber: number;
    overallScore: number;
    protocolScore: number;
    businessScore: number;
    timestamp: string;
  }>;
  direction: 'improving' | 'stable' | 'degrading' | 'volatile';
  improvementRate: number;
  regressions: Array<{
    runNumber: number;
    dimension: string;
    drop: number;
    likelyCause: string;
  }>;
}

// ── Overall Verdict ──────────────────────────────────────────────────────────

export interface RuntimeCertification {
  protocolCompliance: number;   // percentage
  determinism: 'PASS' | 'WARNING' | 'FAIL';
  recoverability: 'PASS' | 'WARNING' | 'FAIL';
  providerNeutrality: 'PASS' | 'WARNING' | 'FAIL';
  freezeGate: 'APPROVED' | 'PENDING' | 'BLOCKED';
}

export interface OverallVerdict {
  architecture: 'PASS' | 'FAIL';
  quality: 'PASS' | 'WARNING' | 'FAIL';
  recovery: 'PASS' | 'PARTIAL' | 'FAIL';
  provider: 'PASS' | 'WARNING' | 'FAIL';
  finalStatus: 'READY_FOR_EXECUTION' | 'BLOCKED';
  blockedReason?: string;
  certification: RuntimeCertification;
}

// ── Root RouteDecision ───────────────────────────────────────────────────────

export interface RouteDecision {
  id: string;
  decision: RouteDecisionType;

  // Protocol compliance
  protocolCompliance: ProtocolComplianceReport;

  // Tier 1
  protocolScore: ProtocolScore[];
  protocolTotal: number;  // 0–100

  // Tier 2
  businessScore: BusinessScore;
  businessTotal: number;  // 0–100

  // Combined
  combinedScore: number;  // weighted: protocol (40%) + business (60%)

  // Trend
  trend?: QualityTrend;

  // Overall
  overallVerdict: OverallVerdict;

  // Routing
  linkedRecoveryActionIds?: RecoveryActionId[];
  confidence: number;       // 0–1
  rationale: string;
  recommendedNextScope?: RecoveryScope;

  // Attribution (top items for debugging)
  topAttributions: Array<{
    source: string;
    impact: number;
    description: string;
  }>;

  // Context
  evaluatedAt: string;     // ISO 8601
  evaluator: 'auto' | 'llm' | 'human';
}

// ── Route Decision Helper ────────────────────────────────────────────────────

export function decideRoute(
  protocolCompliance: ProtocolComplianceReport,
  protocolScore: number,
  businessScore: number,
  recoveryConfidence: number,
): RouteDecisionType {
  if (protocolCompliance.overall === 'FAIL') {
    return RouteDecisionType.ARCHITECTURE_FAIL;
  }

  const combined = protocolScore * 0.4 + businessScore * 0.6;

  if (combined >= 85) return RouteDecisionType.PASS;
  if (combined >= 50 && recoveryConfidence >= 0.3) return RouteDecisionType.AUTO_RECOVER;
  if (combined >= 50 && recoveryConfidence < 0.3) return RouteDecisionType.HUMAN_REVIEW;
  return RouteDecisionType.FULL_REPLAN;
}
