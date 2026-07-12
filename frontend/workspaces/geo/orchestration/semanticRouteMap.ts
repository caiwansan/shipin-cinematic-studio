/**
 * semanticRouteMap — SSOT mapping from WorkflowSemanticState → Vue Route
 *
 * Phase 1: 5-state closed loop (no extensions).
 * Source of truth for useSemanticRouter.
 *
 * ⚠️  Only semantic states listed here may drive navigation.
 *     Any state not listed = no automatic route change.
 */

import type { WorkflowSemanticState } from '../types/state'

/**
 * semanticRouteMap — SSOT mapping from WorkflowSemanticState → Vue Route
 *
 * Phase C: Updated for Sprint 4-1 Product Assembly.
 * The flow: Discovery → Recommendations → Mission Center → Verification
 *
 * ⚠️  Only semantic states listed here may drive navigation.
 *     Any state not listed = no automatic route change.
 */

import type { WorkflowSemanticState } from '../types/state'

export const semanticRouteMap: Partial<Record<WorkflowSemanticState, string>> = {
  ENTRY_START:            '/workspace/geo/discovery',
  FIRST_MISSION_CREATED:  '/workspace/geo/mission-center',
  WORKFLOW_ACTIVE:        '/workspace/geo/mission-center',
  WORKFLOW_COMPLETED:     '/workspace/geo/verification',
  WORKFLOW_EXIT:          '/workspace/geo/dashboard',
}
