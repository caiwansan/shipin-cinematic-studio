import type { DirectorScene, DirectorExecutionPlan, DirectorProjection } from '../api/director.js';

/**
 * ⚠️ Bridge layer: normalize old types to new contracts.
 * Does not modify business logic — only adapts types.
 */

export function normalizeScene(input: Record<string, unknown>): DirectorScene {
  return {
    id: (input.id ?? crypto.randomUUID()) as string,
    projectId: (input.project_id ?? input.projectId ?? '') as string,
    type: (input.type === 'transition' ? 'transition' : input.type === 'cut' ? 'cut' : 'scene') as 'scene' | 'transition' | 'cut',
    content: (input.content ?? input.description ?? '') as string,
    description: input.description as string | undefined,
    confidence: (input.confidence as number) ?? 0.5,
    metadata: (input.metadata ?? {}) as Record<string, unknown>,
    characters: input.characters as string[] | undefined,
    location: input.location as string | undefined,
  };
}

export function normalizeExecutionPlan(input: Record<string, unknown>): DirectorExecutionPlan {
  const rawScenes = (input.scenes ?? []) as Record<string, unknown>[];
  return {
    id: (input.id ?? crypto.randomUUID()) as string,
    projectId: (input.project_id ?? input.projectId ?? '') as string,
    scenes: rawScenes.map(normalizeScene),
    narrative: input.narrative as DirectorExecutionPlan['narrative'] | undefined,
    status: (['draft', 'ready', 'running', 'done', 'failed'].includes(input.status as string)
      ? input.status as DirectorExecutionPlan['status']
      : 'draft'),
    createdAt: (input.createdAt as number) ?? Date.now(),
    updatedAt: input.updatedAt as number | undefined,
  };
}

export function normalizeProjection(input: Record<string, unknown>): DirectorProjection {
  return {
    id: (input.id ?? crypto.randomUUID()) as string,
    projectId: (input.project_id ?? input.projectId ?? '') as string,
    energy: (input.energy as number) ?? 0,
    drift: (input.drift as number) ?? 0,
    state: (input.state ?? {}) as Record<string, unknown>,
    timestamp: (input.timestamp as number) ?? Date.now(),
  };
}
