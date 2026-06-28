import { describe, it, expect } from 'vitest';
import {
  createRecoveryActionId,
  RecoveryAction,
  RecoveryScope,
  RecoveryTargetProtocol,
  RecoveryActionType,
  FailureCategory,
  RootCauseGraph,
  DiagnosisChainEntry,
} from '../recovery/recovery-action';
import {
  RouteDecision,
  RouteDecisionType,
  decideRoute,
  ProtocolComplianceReport,
  ProtocolScore,
  BusinessScore,
} from '../evaluation/route-decision';

describe('RecoveryAction — Recovery Protocol', () => {
  it('creates unique ID', () => {
    expect(createRecoveryActionId()).toBeTruthy();
  });

  it('builds a RecoveryAction with RootCauseGraph', () => {
    const rootCause: RootCauseGraph = {
      rootCauses: [
        {
          id: 'rc-1',
          category: FailureCategory.REFERENCE,
          description: 'Missing character appearance reference',
          confidence: 0.85,
          children: [],
        },
      ],
      primaryCategory: FailureCategory.REFERENCE,
      isMultiCausal: false,
    };

    const diagnosisChain: DiagnosisChainEntry[] = [
      { step: 1, check: 'ReferenceCoverage', result: 'characterCoverage=0.3', confidence: 0.9 },
      { step: 2, check: 'HasCriticalGap', result: 'true', confidence: 0.8 },
    ];

    const action: RecoveryAction = {
      id: createRecoveryActionId(),
      runId: 'run-001' as any,
      targetProtocol: RecoveryTargetProtocol.REFERENCE,
      targetModule: 'ReferenceResolver',
      targetId: 'ref-assign-001',
      scope: RecoveryScope.REFERENCE,
      priority: 1,
      actionType: RecoveryActionType.BUILD_ASSET,
      rootCause,
      diagnosisChain,
      detectionConfidence: 0.85,
      recoveryConfidence: 0.75,
      expectedOutcome: 'Character appearance asset generated',
      fallbackOnFail: RecoveryScope.CONSTRAINT,
      createdAt: new Date().toISOString(),
    };

    expect(action.rootCause.primaryCategory).toBe(FailureCategory.REFERENCE);
    expect(action.scope).toBe(RecoveryScope.REFERENCE);
    expect(action.fallbackOnFail).toBe(RecoveryScope.CONSTRAINT);
  });
});

describe('RouteDecision — Evaluation Protocol', () => {
  it('decideRoute returns ARCHITECTURE_FAIL on compliance failure', () => {
    const compliance: ProtocolComplianceReport = {
      principles: [{ principle: 'Immutable Intent', status: 'FAIL', evidence: 'Decision mutated' }],
      overall: 'FAIL',
    };
    expect(decideRoute(compliance, 90, 90, 1.0)).toBe(RouteDecisionType.ARCHITECTURE_FAIL);
  });

  it('decideRoute returns PASS on high scores', () => {
    const compliance: ProtocolComplianceReport = {
      principles: [],
      overall: 'PASS',
    };
    expect(decideRoute(compliance, 90, 90, 1.0)).toBe(RouteDecisionType.PASS);
  });

  it('decideRoute returns AUTO_RECOVER on medium score with confidence', () => {
    const compliance: ProtocolComplianceReport = {
      principles: [],
      overall: 'PASS',
    };
    expect(decideRoute(compliance, 60, 60, 0.5)).toBe(RouteDecisionType.AUTO_RECOVER);
  });

  it('decideRoute returns HUMAN_REVIEW on medium score with low confidence', () => {
    const compliance: ProtocolComplianceReport = {
      principles: [],
      overall: 'PASS',
    };
    expect(decideRoute(compliance, 60, 60, 0.2)).toBe(RouteDecisionType.HUMAN_REVIEW);
  });

  it('decideRoute returns FULL_REPLAN on low score', () => {
    const compliance: ProtocolComplianceReport = {
      principles: [],
      overall: 'PASS',
    };
    expect(decideRoute(compliance, 30, 30, 0.5)).toBe(RouteDecisionType.FULL_REPLAN);
  });
});
