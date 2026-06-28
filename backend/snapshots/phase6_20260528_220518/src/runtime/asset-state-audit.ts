/**
 * A2-4 asset-state-audit.ts — 状态变更审计
 *
 * 所有状态变更写入 InvocationLog 表。
 * DB 持久化，替代纯内存方案。
 */

import { prisma } from '../utils/index.js'
import type { AssetStatus } from './asset-status.enum.js'

export type StateActor = 'system' | 'user' | 'agent' | 'api'

export interface StateChangeEntry {
  assetRegistryId: string
  projectId: string
  fromStatus: AssetStatus
  toStatus: AssetStatus
  actor: StateActor
  actorId?: string
  reason?: string
}

export class StateAudit {
  /**
   * 记录一次状态变更
   */
  static async log(entry: StateChangeEntry): Promise<void> {
    await prisma.invocationLog.create({
      data: {
        userId: entry.actorId || '191e5de6-0312-44f9-ace2-1908f6c5248a',
        projectId: entry.projectId,
        traceId: `state_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        capability: 'state_machine',
        provider: 'system',
        model: 'state_transition',
        status: 'success',
        operationType: `state:${entry.fromStatus}→${entry.toStatus}`,
        agentType: entry.actor,
        assetRegistryId: entry.assetRegistryId,
      },
    })
  }

  /**
   * 查询某个资产的所有状态变更记录
   */
  static async getLogs(assetRegistryId: string) {
    return prisma.invocationLog.findMany({
      where: {
        assetRegistryId,
        capability: 'state_machine',
      },
      orderBy: { createdAt: 'asc' },
    })
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "asset-state",
  "mode": "SHADOW"
};

