/**
 * DAG Runtime — 图状态计算核心
 *
 * 职责：定义流程依赖图，计算每个 stage 的可执行性。
 * 从 pipeline.ts 分离出来，消除循环引用。
 */

import { prisma } from '../utils/index.js'

// ══════════════════════════════════════════════════════════
// Stage 依赖图定义（DAG）
// ══════════════════════════════════════════════════════════

export interface StageDef {
  key: string
  dependsOn: string[]
  optional: boolean
  parallelizable: boolean
  label: string
}

export interface ResolvedStage {
  key: string
  status: string
  dependsOn: string[]
  blockedBy: string[]
  blockReason: string | null
  ready: boolean
  optional: boolean
  label: string
  error?: string | null
  outputData?: any
  referenceUrls?: any
}

export const STAGE_GRAPH: Record<string, StageDef> = {
  character:  { key: 'character',  dependsOn: [],            optional: false, parallelizable: false, label: '角色设定' },
  scene:      { key: 'scene',      dependsOn: [],            optional: false, parallelizable: false, label: '场景设定' },
  storyboard: { key: 'storyboard', dependsOn: ['character', 'scene'], optional: false, parallelizable: false, label: '分镜设计' },
  voice:      { key: 'voice',      dependsOn: [],            optional: true,  parallelizable: true,  label: '音色设计' },
  frame:      { key: 'frame',      dependsOn: ['storyboard'], optional: false, parallelizable: false, label: '首尾帧' },
  director:   { key: 'director',   dependsOn: ['storyboard'], optional: true,  parallelizable: false, label: '导演点评' },
}

export const STAGE_ORDER = Object.keys(STAGE_GRAPH)

/**
 * 根据 DAG 定义和数据库中的 stage 状态，计算全图可执行性。
 * 这是 Runtime 唯一的状态判决者。
 * - blocked: 有前置依赖未完成（且非 optional）
 * - ready: 所有前置依赖已完成
 * - 不执行任何副作用
 */
export function resolveGraph(
  definitions: Record<string, StageDef>,
  dbStages: Map<string, { status: string; outputData?: any; referenceUrls?: any; error?: string | null }>
): ResolvedStage[] {
  return STAGE_ORDER.map(key => {
    const def = definitions[key]
    if (!def) return null

    const db = dbStages.get(key)
    const currentStatus = db?.status || 'pending'
    const isDone = currentStatus === 'done' || currentStatus === 'skipped'

    // 计算被哪些 stage 阻塞
    const blockedBy: string[] = []
    for (const dep of (def?.dependsOn || [])) {
      const depStage = dbStages.get(dep)
      const depStatus = depStage?.status || 'pending'
      if (depStatus !== 'done' && depStatus !== 'skipped') {
        blockedBy.push(dep)
      }
    }

    let status = currentStatus
    let blockReason: string | null = null

    if (isDone) {
      // 已完成的 stage 保持原状态
    } else if (blockedBy.length > 0) {
      status = 'blocked'
      const stageNames = blockedBy.map(k => definitions[k]?.label || k).join('、')
      blockReason = `等待 「${stageNames}」 完成`
    } else if (currentStatus === 'pending') {
      status = 'ready'
    }
    // processing / failed / partial 保持原样

    return {
      key,
      status,
      dependsOn: def.dependsOn,
      blockedBy,
      blockReason,
      ready: status === 'ready',
      optional: def.optional,
      label: def.label,
      error: db?.error ?? null,
      outputData: db?.outputData,
      referenceUrls: db?.referenceUrls,
    }
  }).filter(Boolean) as ResolvedStage[]
}

export async function loadDbStages(projectId: string): Promise<Map<string, any>> {
  const stages = await prisma.pipelineStage.findMany({
    where: { projectId },
  })
  const map = new Map<string, any>()
  for (const s of stages) {
    map.set(s.stageKey, s)
  }
  return map
}

/**
 * 重新计算所有 blocked 状态。
 * 当某个 stage 状态变化时调用，更新下游被阻塞的 stage。
 */
export async function recalcBlockedStages(projectId: string) {
  const dbStages = await loadDbStages(projectId)
  const graph = resolveGraph(STAGE_GRAPH, dbStages)

  for (const node of graph) {
    if (node.status === 'done' || node.status === 'skipped' || node.status === 'partial') continue
    if (node.status === 'blocked' || node.status === 'pending' || node.status === 'ready') {
      const newStatus = node.ready ? 'ready' : 'blocked'
      await prisma.pipelineStage.upsert({
        where: { projectId_stageKey: { projectId, stageKey: node.key } },
        create: {
          projectId,
          stageKey: node.key,
          status: newStatus,
          blockedBy: node.blockedBy.join(','),
          blockReason: node.blockReason,
        },
        update: {
          status: newStatus,
          blockedBy: node.blockedBy.join(','),
          blockReason: node.blockReason,
        },
      })
    }
  }
}
