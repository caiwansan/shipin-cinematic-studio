// ============================================================================
// ExecutionPlanBuilder — A2.2: DirectorDecision → ExecutionPlan
//
// Consumes only DirectorDecision (Intent Protocol). Does NOT read Storyboard,
// ShotGraph, or any other source. This enforces the Intent Protocol boundary.
//
// Phase A2.2 scope: Build basic CameraPlan from DirectorDecision.camera[].
// Future phases will add ActorPlan, MotionPlan, etc.
// ============================================================================

import type { DirectorDecision, CameraDecision } from '@director-v2/protocols/intent/director-decision';
import type { ExecutionPlan, CameraPlan, CameraComposition } from '@director-v2/protocols/execution/execution-plan';
import { createExecutionPlanId } from '@director-v2/protocols/execution/execution-plan';
import { createDirectorDecisionId } from '@director-v2/protocols/intent/director-decision';
import crypto from 'crypto';

// ── CameraIntent → Composition heuristics ────────────────────────────────────

/**
 * Maps camera intent keywords to shot sizes.
 * These are simple heuristics — Spatial Planner (A3) will override.
 */
function inferShotSize(intent: string, mood: string): CameraComposition['shotSize'] {
  const lower = (intent + ' ' + mood).toLowerCase();

  if (lower.includes('environment') || lower.includes('establish') || lower.includes('atmospheric')) return 'wide';
  if (lower.includes('reveal') || lower.includes('dramatic')) return 'full';
  if (lower.includes('intimate') || lower.includes('reaction') || lower.includes('dialogue')) return 'medium_close_up';
  if (lower.includes('tension') || lower.includes('confront')) return 'medium';
  if (lower.includes('intense') || lower.includes('impact') || lower.includes('climax')) return 'close_up';
  if (lower.includes('energy') || lower.includes('dynamic')) return 'medium';
  return 'medium';
}

function inferAngle(intent: string, mood: string): CameraComposition['angle'] {
  const lower = (intent + ' ' + mood).toLowerCase();

  if (lower.includes('tension') || lower.includes('confront')) return 'dutch';
  if (lower.includes('dramatic') || lower.includes('power')) return 'low_angle';
  if (lower.includes('reveal') || lower.includes('mysterious')) return 'high_angle';
  if (lower.includes('intimate')) return 'eye_level';
  return 'eye_level';
}

function inferMovement(intent: string, mood: string): CameraComposition['movement'] {
  const lower = (intent + ' ' + mood).toLowerCase();

  if (lower.includes('energy') || lower.includes('dynamic')) return 'handheld';
  if (lower.includes('tension') || lower.includes('reveal')) return 'dolly';
  if (lower.includes('establish') || lower.includes('atmospheric')) return 'pan';
  if (lower.includes('intimate')) return 'static';
  return 'static';
}

function deterministicHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

// ── DirectorDecision → ExecutionPlan ─────────────────────────────────────────

export function buildExecutionPlan(decision: DirectorDecision): ExecutionPlan {
  const planId = createExecutionPlanId();

  const cameraPlans: CameraPlan[] = decision.camera.map((cam, index) => {
    const composition: CameraComposition = {
      shotSize: inferShotSize(cam.cameraIntent, cam.mood),
      angle: inferAngle(cam.cameraIntent, cam.mood),
      movement: inferMovement(cam.cameraIntent, cam.mood),
    };

    const hashInput = `${decision.id}-${index}-${JSON.stringify(composition)}`;
    const cameraPlan: CameraPlan = {
      id: `cp-${planId}-${index}`,
      directorIntent: cam.cameraIntent,
      motivation: `${cam.mood} mood: ${cam.cameraIntent} — focus on ${cam.focus}`,
      composition,
      constraints: [],
      referenceBindings: [],
      reasoning: `CameraPlan derived from DirectorDecision [${cam.cameraIntent}] — ${cam.mood}`,
      deterministicHash: deterministicHash(hashInput),
    };

    return cameraPlan;
  });

  const plan: ExecutionPlan = {
    id: planId,
    directorDecisionId: decision.id,
    cameraPlans,
    deterministicHash: deterministicHash(JSON.stringify({
      decisionId: decision.id,
      revision: decision.semanticRevision,
      cameraCount: cameraPlans.length,
      compositionSignatures: cameraPlans.map((p) => p.deterministicHash).join(','),
    })),
    createdAt: new Date().toISOString(),
  };

  return plan;
}
