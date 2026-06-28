/**
 * asset-registry.service.ts — 注册中心（Index Layer）
 *
 * AssetRegistry CRUD + sourceId 映射。
 * 只依赖 A1-1 的类型定义。
 *
 * ⚠️ 状态变更不走此处 updateStatus，请走 StateMachine.transition()
 */

import { prisma } from '../utils/index.js'
import type { AssetType, AssetStatus } from './asset-canonical.schema.js'

interface CreateRegistryParams {
  projectId: string
  type: AssetType
  sourceId: string
  sortOrder?: number
}

interface UpdateRegistryParams {
  status?: AssetStatus
  currentVersion?: number
  sortOrder?: number
}

export class AssetRegistryService {
  /**
   * 创建资产注册记录
   */
  async create(params: CreateRegistryParams) {
    const { projectId, type, sourceId, sortOrder = 0 } = params
    return prisma.assetRegistry.create({
      data: {
        projectId,
        type,
        sourceId,
        sortOrder,
        status: 'draft',
        currentVersion: 1,
      },
    })
  }

  /**
   * 根据 ID 获取注册记录
   */
  async getById(id: string) {
    return prisma.assetRegistry.findUnique({ where: { id } })
  }

  /**
   * 列出项目的所有资产
   */
  async listByProject(projectId: string, type?: AssetType) {
    const where: any = { projectId }
    if (type) where.type = type
    return prisma.assetRegistry.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * 更新资产注册记录
   */
  async update(id: string, params: UpdateRegistryParams) {
    return prisma.assetRegistry.update({
      where: { id },
      data: params,
    })
  }

  /**
   * 更新状态
   * ⚠️ 外部请走 StateMachine.transition()，不要直接调此方法
   * @internal
   */
  async updateStatus(id: string, status: AssetStatus) {
    return prisma.assetRegistry.update({
      where: { id },
      data: { status },
    })
  }

  /**
   * 根据 projectId + type + sourceId 查找（upsert 用）
   */
  async findBySource(projectId: string, type: AssetType, sourceId: string) {
    return prisma.assetRegistry.findUnique({
      where: {
        projectId_type_sourceId: { projectId, type, sourceId },
      },
    })
  }

  /**
   * 删除注册记录（不会删除源数据）
   */
  async delete(id: string) {
    return prisma.assetRegistry.delete({ where: { id } })
  }
}

export const assetRegistry = new AssetRegistryService()
