// ============================================================================
// A3.4 Constraint Provenance — Traceability back to source protocol objects
//
// Every constraint carries metadata linking it back to the protocol objects
// that generated it. This enables Recovery to trace root causes without
// guesswork.
// ============================================================================

import type { ExecutionPlan, CameraPlan } from '@director-v2/protocols/execution/execution-plan';
import type { DirectorDecision } from '@director-v2/protocols/intent/director-decision';
import type { Constraint } from '@director-v2/protocols/constraint/constraint';

export interface ConstraintProvenance {
  /** Human-readable trace of how this constraint was derived */
  trace: string[];
  /** Links to source protocol objects */
  sourceDecisionId?: string;
  sourcePlanId?: string;
  sourceCameraPlanId?: string;
}

export function getConstraintProvenance(
  constraint: Constraint,
  decision: DirectorDecision,
  plan: ExecutionPlan,
): ConstraintProvenance {
  const trace: string[] = [`Constraint ${constraint.id}`, `Source: ${constraint.source}`, `Category: ${constraint.category}`, `Scope: ${constraint.scope}`, `Priority: ${constraint.priority}`];

  // Find the CameraPlan that generated this constraint (approximate)
  const matchedPlan = plan.cameraPlans.find((cp) => {
    if (constraint.lifetime) {
      return constraint.lifetime.fromShotIndex < plan.cameraPlans.indexOf(cp) + 1;
    }
    return false;
  });

  return {
    trace,
    sourceDecisionId: decision.id,
    sourcePlanId: plan.id,
    sourceCameraPlanId: matchedPlan?.id,
  };
}

export function printConstraintTrace(constraint: Constraint): string {
  const parts = [
    `[${constraint.state}] ${constraint.payload.statement}`,
    `  source: ${constraint.source} | priority: ${constraint.priority} | scope: ${constraint.scope}`,
    `  category: ${constraint.category} | lifetime: ${constraint.lifetime ? `${constraint.lifetime.fromShotIndex}→${constraint.lifetime.toShotIndex}` : 'none'}`,
    `  reason: ${constraint.reason}`,
  ];
  return parts.join('\n');
}
