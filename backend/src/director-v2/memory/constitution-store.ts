/**
 * constitution-store.ts — StoryConstitution 持久化存储
 *
 * Constitution 一旦写入就是不可变的（immutable=true）。
 * 任何对同一 project 的重新编译都会创建新记录（不同 constitutionHash），不会覆盖旧记录。
 * 违反此规则会抛出 ConstitutionImmutabilityError。
 */

import { prisma } from '../../utils/index.js'
import { calculateConstitutionFingerprint } from './constitution-fingerprint.js'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Errors
// ============================================================

export class ConstitutionImmutabilityError extends Error {
  constructor(projectId: string, existingHash: string) {
    super(
      `Constitution immutability violation: project ${projectId} already has constitution ${existingHash}. ` +
      'Cannot overwrite. Create a new version instead.',
    )
    this.name = 'ConstitutionImmutabilityError'
  }
}

// ============================================================
// Store Result
// ============================================================

export interface ConstitutionRecord {
  id: string
  projectId: string
  schemaVersion: string
  constitutionVersion: string
  constitutionHash: string
  constitution: StoryConstitution
  immutable: boolean
  degraded: boolean
  degradeReason: string | null
  confidence: number
  createdAt: Date
}

// ============================================================
// Constitution Store
// ============================================================

export class ConstitutionStore {
  /**
   * 保存 Constitution（不可变写入）
   *
   * 规则：
   *   - 如果同一 project 已有 constitution，抛出 ConstitutionImmutabilityError
   *   - 指纹相同的 constitution 算重复，直接返回已有记录（幂等）
   */
  async save(constitution: StoryConstitution): Promise<ConstitutionRecord> {
    const fingerprint = calculateConstitutionFingerprint(constitution)

    // 检查指纹是否已存在（幂等）
    const existing = await prisma.storyConstitution.findUnique({
      where: { constitutionHash: fingerprint.hash },
    })
    if (existing) {
      return this.toRecord(existing)
    }

    // 检查同一 project 是否已有 constitution（不可变规则）
    const projectConstitution = await prisma.storyConstitution.findFirst({
      where: { projectId: constitution.projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (projectConstitution) {
      throw new ConstitutionImmutabilityError(constitution.projectId, projectConstitution.constitutionHash)
    }

    // 写入
    const created = await prisma.storyConstitution.create({
      data: {
        projectId: constitution.projectId,
        schemaVersion: constitution.schemaVersion,
        constitutionVersion: constitution.constitutionVersion,
        constitutionHash: fingerprint.hash,
        constitution: constitution as unknown as Record<string, unknown>,
        immutable: true,
        degraded: constitution.degraded,
        degradeReason: constitution.degradeReason || null,
        confidence: constitution.confidence,
      },
    })

    return this.toRecord(created)
  }

  /**
   * 获取 project 最新的 Constitution
   */
  async getLatestByProject(projectId: string): Promise<ConstitutionRecord | null> {
    const record = await prisma.storyConstitution.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return record ? this.toRecord(record) : null
  }

  /**
   * 通过 constitutionHash 精确查找
   */
  async getByHash(hash: string): Promise<ConstitutionRecord | null> {
    const record = await prisma.storyConstitution.findUnique({
      where: { constitutionHash: hash },
    })

    return record ? this.toRecord(record) : null
  }

  /**
   * 获取 project 的所有 Constitution 版本历史
   */
  async getHistoryByProject(projectId: string): Promise<ConstitutionRecord[]> {
    const records = await prisma.storyConstitution.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return records.map(r => this.toRecord(r))
  }

  /**
   * 检查 project 是否已有 Constitution
   */
  async exists(projectId: string): Promise<boolean> {
    const count = await prisma.storyConstitution.count({
      where: { projectId },
    })

    return count > 0
  }

  /**
   * Prisma → Record 转换
   */
  private toRecord(raw: any): ConstitutionRecord {
    return {
      id: raw.id,
      projectId: raw.projectId,
      schemaVersion: raw.schemaVersion,
      constitutionVersion: raw.constitutionVersion,
      constitutionHash: raw.constitutionHash,
      constitution: raw.constitution as StoryConstitution,
      immutable: raw.immutable,
      degraded: raw.degraded,
      degradeReason: raw.degradeReason,
      confidence: raw.confidence,
      createdAt: raw.createdAt,
    }
  }
}

/** 全局单例 */
export const constitutionStore = new ConstitutionStore()
