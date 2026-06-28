/**
 * kernel-v1/kernel.ts — CanonicalKernel 主类 (v1.1: Causal Layer)
 *
 * 职责：
 * 1. 唯一读入口  → read(projectId)
 * 2. 唯一写入口  → command(KernelCommand)
 * 3. 执行 Pipeline → Validate → Apply → EventLog → Causal Link
 * 4. 运行时权限强制拦截
 *
 * v1.1 升级：
 * - eventLog.append() 增强为接收 CausalMeta
 * - EntityGraph.apply() 返回 diff 信息
 * - 因果链写入 EventLinker
 * - reconstruction replay: getAllUntil(eventId) → rebuild
 */

import { KernelCommand, KernelCommandResult, KernelReadResult } from './types.js'
import { KernelValidator } from './validate.js'
import { EventLogStore, CausalMeta } from './event-log.js'
import { EntityGraphStore } from './entity-graph.js'
import { EventLinker } from './causal/event-linker.js'
import { CausalityMapper, DiffSnapshot } from './causal/causality-mapper.js'
import { CausalConstraintEngine } from './causal-constraints/index.js'
import { causalHardGate, CausalHardEnforcer } from './causal-hardening/kernel-patch.js'

// ...existing code...

export class CanonicalKernel {
  private validator: KernelValidator
  private eventLog: EventLogStore
  private entityGraph: EntityGraphStore
  private causal: EventLinker
  private causalEngine: CausalConstraintEngine
  private causalHardEnforcer: CausalHardEnforcer

  constructor() {
    this.validator = new KernelValidator()
    this.eventLog = new EventLogStore()
    this.entityGraph = new EntityGraphStore(this.eventLog)
    this.causal = new EventLinker()
    this.causalEngine = new CausalConstraintEngine()
    this.causalHardEnforcer = new CausalHardEnforcer(this.causalEngine)
  }

  /**
   * Kernel 实例访问
   */
  get stores() {
    return {
      eventLog: this.eventLog,
      entityGraph: this.entityGraph,
      causal: this.causal,
    }
  }

  // =================================================================
  // 唯一写入口 (v1.1: 因果链集成)
  // =================================================================

  async command(cmd: KernelCommand): Promise<KernelCommandResult> {
    // 🔴 HARD GATE (v1.3) — 任何 mutation 在进入 kernel 前必须通过双重物理约束
    causalHardGate(cmd, this.causalHardEnforcer)

    // Step 1: Validate
    this.validator.validate(cmd)

    // Step 1.5: Causal Constraint Enforcement (v1.2)
    const history = await this.eventLog.getByProject(cmd.payload.projectId)
    this.causalEngine.enforce(
      {
        id: cmd.payload.entityId ?? 'pending',
        source: cmd.source,
        parentEventId: cmd.payload.parentEventId,
        affectedEntityIds: cmd.target === 'EntityGraph' ? [cmd.payload.entityId ?? ''].filter(Boolean) : [],
        affectedTimelineIds: cmd.target === 'Timeline' ? [cmd.payload.entityId ?? ''].filter(Boolean) : [],
        reason: cmd.payload.reason,
      },
      history.map(e => ({ id: e.id, parentEventId: e.payload?.parentEventId })),
    )

    // Step 2: Apply with diff tracking
    let result: any
    let diffSnapshot: DiffSnapshot | null = null

    switch (cmd.target) {
      case 'EntityGraph': {
        const snapshotBefore = this.entityGraph.snapshotIds(cmd.payload.projectId)
        result = await this.entityGraph.apply(cmd)
        const snapshotAfter = this.entityGraph.snapshotIds(cmd.payload.projectId)
        diffSnapshot = CausalityMapper.diffSnapshots(snapshotBefore, snapshotAfter)
        break
      }
      case 'EventLog':
        result = { ok: true }
        break
      case 'Timeline':
        result = { ok: true, message: '[Kernel] Timeline target not implemented in v1' }
        break
      default:
        throw new Error(`[Kernel] unknown target: ${cmd.target}`)
    }

    // Step 3: Build causal meta from apply result
    const causalMeta: CausalMeta = {
      triggeredBy: cmd.source,
      parentEventId: cmd.payload.parentEventId,
      affectedEntityIds: diffSnapshot
        ? [
            ...(diffSnapshot.created?.map(e => e.id) ?? []),
            ...(diffSnapshot.updated?.map(e => e.id) ?? []),
            ...(diffSnapshot.deleted?.map(e => e.id) ?? []),
          ]
        : (result?.entityIds ?? []),
      affectedTimelineIds: result?.timelineIds ?? [],
    }

    // Step 4: Append event with causal binding
    const event = await this.eventLog.append(cmd, causalMeta)

    // Step 5: Write causal graph
    this.causal.link(event.id, {
      eventId: event.id,
      parentEventId: causalMeta.parentEventId,
      triggeredBy: causalMeta.triggeredBy,
      affects: {
        entityIds: causalMeta.affectedEntityIds ?? [],
        timelineIds: causalMeta.affectedTimelineIds ?? [],
      },
      diffId: event.id,
    })

    // Step 6: Write generated entityId back to event payload
    if (result && result.id) {
      event.payload.entityId = result.id
    }

    return {
      ok: true,
      event,
      result: diffSnapshot ? { ...result, diff: diffSnapshot } : result,
    }
  }

  // =================================================================
  // 唯一读入口
  // =================================================================

  async read(projectId: string): Promise<KernelReadResult> {
    const entities = await this.entityGraph.getAll(projectId)
    const version = await this.entityGraph.getVersion(projectId)
    const entityMap: Record<string, any> = {}

    for (const entity of entities) {
      const key = `${entity.type}:${entity.id}`
      entityMap[key] = entity
    }

    return {
      projectId,
      entityGraph: {
        entities: entityMap,
        version,
      },
    }
  }

  // =================================================================
  // Replay: reconstruction mode (v1.1)
  // =================================================================

  /**
   * 重建到指定 eventId 的状态
   * 1. 获取直到 eventId 的所有事件
   * 2. 清空 EntityGraph 内存
   * 3. 逐条重新 apply
   * 4. 返回重建后的快照
   */
  async replayTo(eventId: string, projectId?: string): Promise<KernelReadResult> {
    const events = await this.eventLog.getAllUntil(projectId ?? '', eventId)
    if (events.length === 0) {
      // Try to find projectId from causal graph
      const link = this.causal.get(eventId)
      if (!link) {
        return this.read(projectId ?? '')
      }
      return this.read(events[0]?.projectId ?? projectId ?? '')
    }

    const pid = events[0].projectId

    // Reset entity graph for this project
    this.entityGraph.clearProject(pid)

    // Reapply all events sequentially
    for (const event of events) {
      const cmd: KernelCommand = {
        source: event.source,
        type: event.type,
        target: event.target,
        payload: event.payload,
      }
      switch (event.target) {
        case 'EntityGraph':
          await this.entityGraph.apply(cmd)
          break
        // Timeline skipped in v1
      }
    }

    return this.read(pid)
  }

  // =================================================================
  // EventLog → EntityGraph 重建 (MVEL 验证核心)
  // =================================================================

  async rebuildProjectState(projectId: string): Promise<KernelReadResult> {
    const graph = await this.entityGraph.rebuildFromEventLog(projectId)
    const entityMap: Record<string, any> = {}

    for (const entity of graph.entities.values()) {
      const key = `${entity.type}:${entity.id}`
      entityMap[key] = entity
    }

    return {
      projectId,
      entityGraph: {
        entities: entityMap,
        version: graph.version,
      },
    }
  }

  // =================================================================
  // Causal query (v1.1)
  // =================================================================

  getCausal(eventId: string) {
    return this.causal.get(eventId)
  }

  trace(eventId: string) {
    return this.causal.trace(eventId)
  }

  getEventsForEntity(entityId: string) {
    return this.causal.getEventsForEntity(entityId)
  }
}

// 导出单例
export const kernel = new CanonicalKernel()
