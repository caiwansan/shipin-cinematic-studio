/**
 * asset-state-machine.ts — StateMachine 主入口
 *
 * 所有 Asset 状态变更的唯一入口。
 * 组合：A2-2 transition() + A2-3 StateGuard + A2-4 StateAudit
 */

import { assetRegistry } from '../services/asset-registry.service.js'
import { transition } from './asset-state-transition.js'
import { StateGuard } from './asset-state-guard.js'
import { StateAudit, type StateActor } from './asset-state-audit.js'
import type { AssetStatus } from './asset-status.enum.js'

export interface TransitionOptions {
  assetId: string
  targetStatus: AssetStatus
  actor: StateActor
  actorId?: string
  reason?: string
}

export class AssetStateMachine {
  /**
   * 执行一次严格状态迁移（唯一入口）
   *
   * 流程：
   *   1. 读当前状态
   *   2. guard 校验
   *   3. 纯函数校验
   *   4. 写 DB
   *   5. 审计日志
   */
  static async transition(options: TransitionOptions): Promise<void> {
    const { assetId, targetStatus, actor, actorId, reason } = options

    // 1. 读取当前状态
    const asset = await assetRegistry.getById(assetId)
    if (!asset) {
      throw new Error(`资产不存在: ${assetId}`)
    }

    const currentStatus = asset.status as AssetStatus

    // 2. guard 校验
    StateGuard.assertNotLocked(currentStatus)

    // 3. 纯函数校验
    transition(currentStatus, targetStatus) // throw if invalid

    // 4. 写入 DB
    await assetRegistry.updateStatus(assetId, targetStatus)

    // 5. 审计日志
    await StateAudit.log({
      assetRegistryId: assetId,
      projectId: asset.projectId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      actor,
      actorId,
      reason,
    })
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "asset-state",
  "mode": "SHADOW"
};

