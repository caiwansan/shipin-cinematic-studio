// ============================================================================
// RecoveryAction — Recovery Protocol (Chapter ⑦)
//
// Produced by RecoveryRouter. Consumed by target modules.
// Supports Partial Recovery First escalation order:
//   REFERENCE → CONSTRAINT → EXECUTION_PLAN → INTENT_REVISION → FULL_REPLAN
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// ── Core Identifiers ─────────────────────────────────────────────────────────

export type RecoveryActionId = string & { readonly __brand: 'RecoveryActionId' };

export function createRecoveryActionId(): RecoveryActionId {
  return uuidv4() as RecoveryActionId;
}

export type RecoveryRunId = string & { readonly __brand: 'RecoveryRunId' };

// ── Target Protocol ──────────────────────────────────────────────────────────

export enum RecoveryTargetProtocol {
  REFERENCE = 'REFERENCE',
  CONSTRAINT = 'CONSTRAINT',
  EXECUTION_PLAN = 'EXECUTION_PLAN',
  INTENT_REVISION = 'INTENT_REVISION',
  /** Full re-plan from DirectorDecision */
  FULL_REPLAN = 'FULL_REPLAN',
}

// ── Recovery Scope ───────────────────────────────────────────────────────────

export enum RecoveryScope {
  /** Resolve references (re-resolve + asset rebuild) */
  REFERENCE = 'REFERENCE',
  /** Adjust constraints within existing plan */
  CONSTRAINT = 'CONSTRAINT',
  /** Modify execution plan (re-plan shots, not intent) */
  EXECUTION_PLAN = 'EXECUTION_PLAN',
  /** Revise part of DirectorDecision (minor intent change) */
  INTENT_REVISION = 'INTENT_REVISION',
  /** Full replan from DirectorDecision (major failure) */
  FULL_REPLAN = 'FULL_REPLAN',
}

// ── Action Type ──────────────────────────────────────────────────────────────

export enum RecoveryActionType {
  RESOLVE = 'RESOLVE',                     // Re-resolve references
  BUILD_ASSET = 'BUILD_ASSET',             // Trigger VAB
  ADJUST_CONSTRAINT = 'ADJUST_CONSTRAINT', // Relax/override a constraint
  RE_PLAN_SHOT = 'RE_PLAN_SHOT',           // Re-plan specific shots
  REVISE_INTENT = 'REVISE_INTENT',         // Revise DirectorDecision
  FULL_REPLAN = 'FULL_REPLAN',             // Re-plan everything
}

// ── Failure Category ─────────────────────────────────────────────────────────

export enum FailureCategory {
  IDENTITY = 'IDENTITY',
  SPATIAL = 'SPATIAL',
  TEMPORAL = 'TEMPORAL',
  STYLE = 'STYLE',
  REFERENCE = 'REFERENCE',
  CONSTRAINT = 'CONSTRAINT',
  EXECUTION = 'EXECUTION',
  PROVIDER = 'PROVIDER',
  INTENT = 'INTENT',
}

// ── Root Cause Graph ─────────────────────────────────────────────────────────

export interface RootCauseNode {
  id: string;
  category: FailureCategory;
  description: string;
  confidence: number;      // 0.0 – 1.0
  children: RootCauseNode[];
}

export interface RootCauseGraph {
  rootCauses: RootCauseNode[];
  /** Primary category (most impactful) */
  primaryCategory: FailureCategory;
  /** Whether root cause spans multiple categories */
  isMultiCausal: boolean;
}

// ── Diagnosis Chain ──────────────────────────────────────────────────────────

export interface DiagnosisChainEntry {
  step: number;
  check: string;
  result: string;
  confidence: number;
}

// ── Root RecoveryAction ──────────────────────────────────────────────────────

export interface RecoveryAction {
  /** Unique action ID */
  id: RecoveryActionId;
  /** Recovery run this belongs to */
  runId: RecoveryRunId;

  /** Which protocol this action targets */
  targetProtocol: RecoveryTargetProtocol;
  /** Which module should execute this */
  targetModule: string;  // "ReferenceResolver" | "SpatialPlanner" | "CameraPlanBuilder" | etc.
  /** Target: ID of the protocol object to recover */
  targetId: string;

  /** Scope of recovery */
  scope: RecoveryScope;
  /** Priority within recovery run */
  priority: number;
  /** Type of action to take */
  actionType: RecoveryActionType;

  /** Root cause (DAG structure) */
  rootCause: RootCauseGraph;

  /** Diagnosis chain (how we arrived at this action) */
  diagnosisChain: DiagnosisChainEntry[];

  /** Confidence in detection (0.0 – 1.0) */
  detectionConfidence: number;
  /** Confidence in recovery success (0.0 – 1.0) */
  recoveryConfidence: number;

  /** Action-specific payload (varies by target module) */
  payload?: Record<string, unknown>;

  /** Expected outcome if recovery succeeds */
  expectedOutcome: string;

  /** Fallback if this recovery action fails */
  fallbackOnFail?: RecoveryScope;

  /** Timestamp */
  createdAt: string;
}

// ── Recovery History ─────────────────────────────────────────────────────────

export interface RecoveryHistoryEntry {
  recoveryId: RecoveryActionId;
  runNumber: number;
  previousScore: number;
  newScore: number;
  improvement: number;
  targetScope: RecoveryScope;
  success: boolean;
  timestamp: string;
}

// ── Continuity Report ────────────────────────────────────────────────────────

export interface ContinuityReport {
  runId: RecoveryRunId;
  shotIndex: number;
  decisionId: string;

  /** 10-dimension continuity check matrix */
  continuityMatrix: Record<string, number>;  // dimension name → score

  /** Detected issues */
  issues: ContinuityIssue[];

  /** Linked RecoveryActions */
  linkedRecoveryActions: RecoveryActionId[];

  /** Summary */
  overallScore: number;
  hasCriticalIssues: boolean;
}

export interface ContinuityIssue {
  category: FailureCategory;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  shotIndex: number;
  relatedProtocolId?: string;
}
