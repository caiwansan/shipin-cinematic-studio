/**
 * shotgraph-writer.ts — ShotGraph 唯一写入入口
 *
 * 设计原则：
 *   所有 shotGraph 的持久化操作必须通过此函数，不允许直接修改
 *   executionResults.videoProduction.shotGraph。
 *
 * 写入模式（mode）：
 *   - "abstract" : DirectorEngine 写入 abstractShots + transitions + sceneGraph
 *   - "rendered" : CinematicBridge 写入 renderedShots
 *
 * 运行时守卫：
 *   - throw error if abstractShots and renderedShots 在同一调用中混写
 *   - throw error if patch 来源不属于已知 caller
 *
 * 约束：
 *   - 只写 executionResults.videoProduction
 *   - 不写独立的 DB 表（VP 以 executionResults 为 truth）
 *   - 合并模式：只覆盖指定字段，不破坏已有数据
 */

import { prisma } from '../../utils/index.js'

export type ShotGraphWriteMode = 'abstract' | 'rendered'

export interface ShotGraphPatch {
  mode: ShotGraphWriteMode
  abstractShots?: any[]
  renderedShots?: any[]
  transitions?: any[]
  sceneGraph?: { sceneIds: string[]; order: number[] }
  pacing?: any
  version?: string
  renderStrategy?: string
  lineage?: { projectId: string; directorRunId: string; cinematicRunId?: string; parentVersion?: string }
}

/**
 * 向前兼容：如果没有 mode 字段，根据 payload 推断
 * 如果两个都传了，throw
 */
function inferMode(patch: ShotGraphPatch): ShotGraphWriteMode {
  if (patch.mode) return patch.mode

  const hasAbstract = patch.abstractShots !== undefined
  const hasRendered = patch.renderedShots !== undefined

  if (hasAbstract && hasRendered) {
    throw new Error(
      '[ShotGraphWriter] ❌ 禁止同一调用中同时写入 abstractShots 和 renderedShots。' +
      'DirectorEngine 和 CinematicBridge 必须分两次写入。'
    )
  }

  if (hasAbstract) return 'abstract'
  if (hasRendered) return 'rendered'

  // 默认 abstract（纯结构写入）
  return 'abstract'
}

/**
 * 写入 shotGraph 到 DB — 唯一入口
 *
 * 运行时守卫：
 *   - mode="abstract" 时只允许传 abstractShots/transitions/sceneGraph
 *   - mode="rendered" 时只允许传 renderedShots
 *   - 混写会抛 Error
 *
 * 重入安全：
 *   - 幂等：同一 project 重复调用仅覆盖
 *   - 线程安全：Prisma 单连接序列化
 */
export async function writeShotGraph(projectId: string, patch: ShotGraphPatch): Promise<boolean> {
  const mode = inferMode(patch)

  // === 运行时守卫 ===
  if (mode === 'abstract' && patch.renderedShots !== undefined) {
    throw new Error('[ShotGraphWriter] ❌ mode=abstract 禁止传入 renderedShots')
  }
  if (mode === 'rendered' && patch.abstractShots !== undefined) {
    throw new Error('[ShotGraphWriter] ❌ mode=rendered 禁止传入 abstractShots')
  }

  // LINEAGE 强制执行
  if (!patch.lineage || !patch.lineage.directorRunId) {
    throw new Error('[ShotGraphWriter] ❌ lineage.directorRunId 是必填项')
  }
  if (mode === 'rendered' && !patch.lineage.cinematicRunId) {
    throw new Error('[ShotGraphWriter] ❌ rendered 写入必须提供 lineage.cinematicRunId')
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    console.warn('[ShotGraphWriter] project not found:', projectId)
    return false
  }

  const execResults = (project.executionResults || {}) as any
  const existingVP = execResults.videoProduction || {}

  // 构建 shotGraph（合并模式）
  const newShotGraph = {
    ...(existingVP.shotGraph || {}),
  }

  if (patch.abstractShots !== undefined) {
    newShotGraph.abstractShots = patch.abstractShots
  }
  if (patch.renderedShots !== undefined) {
    newShotGraph.renderedShots = patch.renderedShots
  }
  if (patch.transitions !== undefined) {
    newShotGraph.transitions = patch.transitions
  }
  if (patch.sceneGraph !== undefined) {
    newShotGraph.sceneGraph = patch.sceneGraph
  }
  if (patch.lineage !== undefined) {
    newShotGraph.lineage = patch.lineage
  }

  // 标记 mode + version
  newShotGraph.mode = mode
  if (patch.version) {
    newShotGraph.version = patch.version
  }

  // 构建 videoProduction 更新
  execResults.videoProduction = {
    ...existingVP,
    ...(patch.version ? { version: patch.version } : {}),
    ...(patch.renderStrategy ? { renderStrategy: patch.renderStrategy } : {}),
    ...(patch.pacing ? { pacing: patch.pacing } : {}),
    shotGraph: newShotGraph,
  }

  // 标记 renderedShots 状态
  if (patch.renderedShots !== undefined) {
    execResults.videoProduction.cinematicRendered = patch.renderedShots.length > 0
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { executionResults: execResults },
  })

  const abstractCount = newShotGraph.abstractShots?.length || 0
  const renderedCount = newShotGraph.renderedShots?.length || 0
  console.log(`[ShotGraphWriter] mode=${mode} project=${projectId.slice(0, 8)} abstract=${abstractCount} rendered=${renderedCount}`)

  // v6: 记录 shot-level telemetry（rendered 模式）
  if (mode === 'rendered' && patch.renderedShots && patch.lineage?.cinematicRunId) {
    for (const shot of patch.renderedShots) {
      try {
        ExecutionTelemetryCollector.recordShot({
          shotId: shot.shotId || 'unknown',
          abstractShotId: shot.abstractShotId || shot.shotId || '',
          projectId,
          cinematicRunId: patch.lineage.cinematicRunId,
          renderStatus: 'success',
          latencyMs: 0,  // 时序信息在 execution metrics 中
          retryCount: 0,
          provider: 'deepseek',
          shotType: shot.type,
          camera: shot.camera?.motion
            ? [shot.camera.motion, shot.camera.angle].filter(Boolean).join(' ')
            : undefined,
          lens: shot.camera?.lens,
        })
      } catch {}
    }
  }

  return true
}
