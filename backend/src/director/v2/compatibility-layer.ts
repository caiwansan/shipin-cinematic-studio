// ============================================================================
// Compatibility Layer — A2.3: ExecutionPlan → Legacy ShotGraph
//
// Temporary adapter so that V1 downstream modules (workbench UI, sync service,
// optimization agents) can still consume V2 output without modification.
//
// To be removed once all consumers are migrated to ExecutionPlan.
// ============================================================================

import type { ExecutionPlan, CameraPlan } from '@director-v2/protocols/execution/execution-plan';
import type { ShotGraph, ShotNode, ShotType } from '../../../runtime/director/shot-graph-schema';

export function executionPlanToShotGraph(plan: ExecutionPlan): ShotGraph {
  const shots: ShotNode[] = plan.cameraPlans.map((cp, index) => {
    const shotType = mapCompositionToShotType(cp);
    return {
      id: `v2-shot-${index}`,
      shotType,
      subject: extractSubjects(cp),
      environment: cp.motivation,
      action: cp.directorIntent,
      duration: 5, // default — to be refined
    };
  });

  return {
    shots,
    meta: {
      totalShots: shots.length,
      narrativeSummary: `V2 Migration — ${shots.length} shots (ExecutionPlan: ${plan.id})`,
    },
  };
}

function mapCompositionToShotType(cp: CameraPlan): ShotType {
  const size = cp.composition.shotSize;
  const angle = cp.composition.angle;
  const movement = cp.composition.movement;
  const intent = cp.directorIntent.toLowerCase();

  if (intent.includes('establish')) return 'establishing';
  if (intent.includes('reveal')) return 'reveal';
  if (intent.includes('confront') || intent.includes('tension')) return 'confrontation';
  if (intent.includes('action') || intent.includes('dynamic') || movement === 'handheld') return 'action';
  if (intent.includes('impact') || intent.includes('climax')) return 'climax';
  if (intent.includes('closure') || intent.includes('ending')) return 'ending';
  if (size === 'medium_close_up' || size === 'close_up') return 'dialogue';
  return 'establishing';
}

function extractSubjects(cp: CameraPlan): string[] {
  const focus = cp.composition.referenceBindings?.length
    ? cp.composition.referenceBindings.map((rb) => rb.assetNodeId || '')
    : [];
  if (focus.length === 0 && cp.motivation.includes('focus on')) {
    const match = cp.motivation.match(/focus on (.+)$/);
    if (match) return [match[1]];
  }
  return focus.length > 0 ? focus : ['scene'];
}
