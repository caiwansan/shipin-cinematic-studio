/**
 * Showrunner Core — Layer 5: Execution Orchestrator
 *
 * 执行统筹层：将制片蓝图拆解为 agent 任务图。
 * - 任务拆解 episode → scene → shot
 * - agent 分配
 * - 执行顺序和依赖
 * - 并行策略
 * - fallback 策略
 */

import { type EpisodeBlueprint } from './structural-planner.js'

// ============================================================
// Execution Task Graph
// ============================================================

export interface ExecutionTaskGraph {
  projectId: string
  totalEpisodes: number
  tasks: EpisodeTask[]
  estimatedTotalRuntime: number
}

export interface EpisodeTask {
  episode: number
  scenes: SceneTask[]
  parallelGroups: string[][]  // 可并行的场景组
}

export interface SceneTask {
  sceneId: string
  agents: string[]
  dependencies: string[]
  estimatedTokens: number
  fallbackStrategy: 'placeholder' | 'simplify' | 'skip'
  priority: number
}

/**
 * 将 blueprint 拆解为可执行的任务图
 */
export function orchestrate(
  blueprint: any,
  projectId: string,
): ExecutionTaskGraph {
  const episodes: EpisodeBlueprint[] = blueprint.episodes || []
  const tasks: EpisodeTask[] = []

  for (const ep of episodes) {
    const scenes: SceneTask[] = (ep.keyScenes || []).map((scene: string, idx: number) => ({
      sceneId: `ep${ep.episode}_scene${idx + 1}`,
      agents: ['DirectorBrainAgent', 'CinematicShotAgent', 'CharacterDirectorAgent', 'SceneAtmosphereAgent', 'PromptCompiler'],
      dependencies: idx > 0 ? [`ep${ep.episode}_scene${idx}`] : [],
      estimatedTokens: ep.priority === 'high' ? 4000 : 2000,
      fallbackStrategy: ep.priority === 'high' ? 'simplify' : 'placeholder',
      priority: ep.priority === 'high' ? 10 : ep.priority === 'medium' ? 5 : 1,
    }))

    // 并行分组：同一集内场景串行，不同集可并行
    const parallelGroups: string[][] = []
    if (scenes.length > 1) {
      parallelGroups.push(scenes.map(s => s.sceneId))
    }

    tasks.push({
      episode: ep.episode,
      scenes,
      parallelGroups,
    })
  }

  return {
    projectId,
    totalEpisodes: episodes.length,
    tasks,
    estimatedTotalRuntime: episodes.length * (5 * 60),  // 每集5分钟 × 60
  }
}

/**
 * 将任务图提交到 Scheduler 执行
 */
export async function dispatchToScheduler(
  taskGraph: ExecutionTaskGraph,
  userId?: string,
): Promise<string[]> {
  const { graphScheduler } = await import('../scheduler/graph-scheduler.js')
  const graphIds: string[] = []

  for (const episode of taskGraph.tasks) {
    const graphId = graphScheduler.submit({
      projectId: taskGraph.projectId,
      userId: userId || 'showrunner',
      priority: episode.scenes.some(s => s.priority >= 10) ? 'high' : 'medium',
      context: { episode, taskGraph },
    })
    graphIds.push(graphId)
  }

  return graphIds
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

