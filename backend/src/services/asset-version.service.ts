/**
 * A3-3 asset-version.service.ts — Version Writer + Lineage
 *
 * createVersion(): 写入新版本（不可变，只追加）
 * listVersions(): 获取版本列表
 * getVersion(): 获取指定版本快照
 *
 * 每个版本创建自动 +1，不修改历史。
 */

import { prisma } from '../utils/index.js'

export class AssetVersionService {
  /**
   * 创建新版本（自动 version + 1）
   */
  async createVersion(params: {
    assetRegistryId: string
    content: Record<string, any>
    prompt?: Record<string, any>
    optimizationType?: string
    agent?: string
    diffSummary?: string
  }) {
    const { assetRegistryId, content, prompt, optimizationType, agent, diffSummary } = params

    // 1. 查最新版本号
    const lastVersion = await prisma.assetVersion.findFirst({
      where: { assetRegistryId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const nextVersion = (lastVersion?.version || 0) + 1

    // 2. 写新记录（不可变）
    const version = await prisma.assetVersion.create({
      data: {
        assetRegistryId,
        version: nextVersion,
        content: content as any,
        prompt: (prompt as any) || undefined,
        optimizationType: optimizationType || undefined,
        agent: agent || undefined,
        diffSummary: diffSummary || undefined,
      },
    })

    // 3. 更新 Registry currentVersion
    await prisma.assetRegistry.update({
      where: { id: assetRegistryId },
      data: { currentVersion: nextVersion },
    })

    return version
  }

  /**
   * 获取资产的所有版本
   */
  async listVersions(assetRegistryId: string) {
    return prisma.assetVersion.findMany({
      where: { assetRegistryId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        optimizationType: true,
        agent: true,
        diffSummary: true,
        createdAt: true,
      },
    })
  }

  /**
   * 获取指定版本的完整内容
   */
  async getVersion(assetRegistryId: string, version: number) {
    return prisma.assetVersion.findUnique({
      where: {
        assetRegistryId_version: { assetRegistryId, version },
      },
    })
  }

  /**
   * 获取版本 lineage（完整的历史链）
   */
  async getLineage(assetRegistryId: string) {
    const versions = await prisma.assetVersion.findMany({
      where: { assetRegistryId },
      orderBy: { version: 'asc' },
    })

    return {
      assetRegistryId,
      nodeCount: versions.length,
      nodes: versions.map(v => ({
        version: v.version,
        agent: v.agent,
        optimizationType: v.optimizationType,
        diffSummary: v.diffSummary,
        createdAt: v.createdAt,
      })),
    }
  }
}

export const assetVersionService = new AssetVersionService()
