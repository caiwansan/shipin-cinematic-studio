/**
 * A3-4 asset-rollback.service.ts — 回滚引擎
 *
 * 规则：
 *   - 回滚 = 从旧快照创建新版本（不修改历史）
 *   - 回滚后状态通过 StateMachine 重置为 draft
 *   - 回滚生成新 version + 差异摘要
 */

import { assetVersionService } from './asset-version.service.js'
import { diffObjects, summarizeDiff } from './asset-diff-schema.js'
import { AssetStateMachine } from '../runtime/asset-state-machine.js'

export class AssetRollbackService {
  /**
   * 回滚到指定版本
   *
   * 1. 获取目标版本快照
   * 2. 比较当前文件与目标版本生成 diff
   * 3. 创建新版本（内容=目标版本快照）
   * 4. 通过 StateMachine 重置状态为 draft
   */
  async rollback(params: {
    assetRegistryId: string
    targetVersion: number
    actor?: 'user' | 'system' | 'agent'
  }) {
    const { assetRegistryId, targetVersion, actor = 'user' } = params

    // 1. 获取目标版本
    const target = await assetVersionService.getVersion(assetRegistryId, targetVersion)
    if (!target) {
      throw new Error(`版本 ${targetVersion} 不存在`)
    }

    // 2. 获取当前最新版本
    const versions = await assetVersionService.listVersions(assetRegistryId)
    const latestVersion = versions[0]?.version || 0
    const latest = latestVersion ? await assetVersionService.getVersion(assetRegistryId, latestVersion) : null
    const currentContent = (latest?.content as Record<string, any>) || {}

    // 3. 计算 diff
    const diff = diffObjects(
      target.content as Record<string, any>,
      currentContent,
      targetVersion,
      latestVersion,
    )

    // 4. 创建新版本（从目标版本恢复）
    const newVersion = await assetVersionService.createVersion({
      assetRegistryId,
      content: target.content as Record<string, any>,
      prompt: target.prompt as Record<string, any> | undefined,
      optimizationType: 'rollback',
      agent: `rollback:v${targetVersion}`,
      diffSummary: `回滚至版本 ${targetVersion}：${summarizeDiff(diff)}`,
    })

    // 5. 重置状态为 draft（通过 StateMachine）
    // 只在非 draft 时重置
    const registry = await import('../services/asset-registry.service.js').then(m => m.assetRegistry)
    const currentAsset = await registry.getById(assetRegistryId)
    if (currentAsset && currentAsset.status !== 'draft') {
      await AssetStateMachine.transition({
        assetId: assetRegistryId,
        targetStatus: 'draft',
        actor,
        reason: `rollback from v${latestVersion} to v${targetVersion}`,
      })
    }

    return {
      newVersion,
      diff,
      rollbackVersion: targetVersion,
      restoredSnapshot: target.content,
    }
  }
}

export const assetRollbackService = new AssetRollbackService()
