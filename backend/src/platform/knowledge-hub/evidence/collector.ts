// ════════════════════════════════════════════════════════════
// P3B-001 / P3B-002 — EvidenceRecord 类型 + 收集器
// ════════════════════════════════════════════════════════════
// 不可变（append-only）：创建后 content/checksum/confidence/collectedAt 不覆盖。
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'
import * as crypto from 'crypto'

// ─── Type ───────────────────────────────────────────────────

export interface EvidenceRecordInput {
  type: 'discovery' | 'knowledge' | 'packaging' | 'distribution' | 'verification' | 'observation'
  scope: 'knowledge' | 'package' | 'distribution' | 'observation' | 'system'
  sourceType: string
  sourceId: string
  sourceVersion: string
  targetType: 'knowledge_object' | 'claim' | 'citation' | 'asset' | 'package' | 'publish_record'
  targetId: string
  content: string
  confidence: number
  level?: 'raw' | 'verified' | 'golden'
  status?: 'pending' | 'confirmed' | 'invalid' | 'expired'
  metadata?: Record<string, any>
  truthId?: string
  verificationId?: string
}

export interface EvidenceRecord extends EvidenceRecordInput {
  id: string
  checksum: string
  collectedAt: Date
  createdAt: Date
}

// ─── Helpers ────────────────────────────────────────────────

function computeChecksum(input: EvidenceRecordInput): string {
  const payload = JSON.stringify({
    type: input.type,
    scope: input.scope,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    content: input.content,
    confidence: input.confidence,
  })
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16)
}

// ─── Collector ──────────────────────────────────────────────

export class EvidenceCollector {
  private prisma: PrismaClient

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient()
  }

  /**
   * 创建并写入一条 EvidenceRecord。
   * 不可变（append-only）：相同 checksum 不重复创建。
   *
   * @returns EvidenceRecord（含 id + checksum + collectedAt）
   */
  async collect(input: EvidenceRecordInput): Promise<EvidenceRecord> {
    const checksum = computeChecksum(input)
    const collectedAt = new Date()
    const id = uuid()

    // 幂等：相同 checksum 在 60 秒内不重复写入
    const recent = await this.prisma.evidenceRecord.findFirst({
      where: { checksum, collectedAt: { gte: new Date(Date.now() - 60000) } },
    })
    if (recent) {
      return recent as any as EvidenceRecord
    }

    const record = await this.prisma.evidenceRecord.create({
      data: {
        id,
        type: input.type,
        scope: input.scope,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceVersion: input.sourceVersion,
        targetType: input.targetType,
        targetId: input.targetId,
        content: input.content,
        confidence: input.confidence,
        checksum,
        level: input.level ?? 'raw',
        status: input.status ?? 'pending',
        metadata: input.metadata ?? {},
        truthId: input.truthId,
        verificationId: input.verificationId,
        collectedAt,
      },
    })

    return record as any as EvidenceRecord
  }

  /**
   * 批量收集
   */
  async collectMany(inputs: EvidenceRecordInput[]): Promise<EvidenceRecord[]> {
    const results: EvidenceRecord[] = []
    for (const input of inputs) {
      results.push(await this.collect(input))
    }
    return results
  }

  // ─── Build 自动收集逻辑 ──

  /**
   * 在 Package Build 完成后自动产生 EvidenceRecord。
   */
  async collectFromBuild(
    packageId: string,
    knowledgeObjectId: string,
    buildId: string,
    title: string,
    version: string,
  ): Promise<EvidenceRecord> {
    return this.collect({
      type: 'packaging',
      scope: 'package',
      sourceType: 'build',
      sourceId: buildId,
      sourceVersion: version,
      targetType: 'package',
      targetId: packageId,
      content: `Package built: ${title}`,
      confidence: 1.0,
      level: 'raw',
      metadata: { buildId, title },
    })
  }

  /**
   * 在 Distribution 完成后自动产生 EvidenceRecord。
   */
  async collectFromDistribution(
    packageId: string,
    publishRecordId: string,
    target: string,
    status: string,
    duration: number,
  ): Promise<EvidenceRecord> {
    return this.collect({
      type: 'distribution',
      scope: 'distribution',
      sourceType: 'publish_record',
      sourceId: publishRecordId,
      sourceVersion: '1.0.0',
      targetType: 'package',
      targetId: packageId,
      content: `Distribution to ${target}: ${status} (${duration}ms)`,
      confidence: status === 'success' ? 1.0 : 0.5,
      level: 'raw',
      status: status === 'success' ? 'confirmed' : 'pending',
      metadata: { target, duration },
    })
  }

  // ─── Query ────────────────────────────────────────────────

  /**
   * 按 target 查询 EvidenceRecord 列表。
   */
  async findByTarget(targetType: string, targetId: string): Promise<EvidenceRecord[]> {
    const records = await this.prisma.evidenceRecord.findMany({
      where: { targetType, targetId },
      orderBy: { collectedAt: 'desc' },
      take: 100,
    })
    return records as any as EvidenceRecord[]
  }

  /**
   * 获取 Evidence 时间线（按 collectedAt 排序）。
   */
  async timeline(targetType: string, targetId: string): Promise<EvidenceRecord[]> {
    return this.findByTarget(targetType, targetId)
  }

  /**
   * 按 packageId 查询完整证据列表（包括 distribution、验证等）。
   */
  async findByPackage(packageId: string): Promise<EvidenceRecord[]> {
    return this.findByTarget('package', packageId)
  }
}
