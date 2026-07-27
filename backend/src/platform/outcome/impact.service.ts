/**
 * ImpactService — ImpactMeasurement CRUD
 * OI-01 Schema Foundation
 */

import { prisma } from '../../utils/index.js'
import type {
  RecordImpactInput,
  ImpactMeasurement,
  ImpactMetricType,
} from './types.js'

export const ImpactService = {
  /**
   * 记录 Impact
   * organizationId 必须来自 Identity Resolution
   */
  async record(input: RecordImpactInput): Promise<ImpactMeasurement> {
    return prisma.impactMeasurement.create({
      data: {
        organizationId: input.organizationId,
        outcomeId: input.outcomeId,
        metricType: input.metricType,
        metricValue: input.metricValue,
        unit: input.unit ?? 'count',
        metadata: input.metadata ?? {},
        source: input.source,
        verifiedAt: input.verifiedAt,
      },
    })
  },

  /**
   * 获取 Outcome 的所有 ImpactMeasurement
   */
  async listByOutcome(
    outcomeId: string,
    organizationId: string,
  ): Promise<ImpactMeasurement[]> {
    return prisma.impactMeasurement.findMany({
      where: {
        outcomeId,
        organizationId,
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  /**
   * 获取组织的所有 ImpactMeasurement
   */
  async listByOrganization(
    organizationId: string,
    options?: { metricType?: ImpactMetricType },
  ): Promise<ImpactMeasurement[]> {
    return prisma.impactMeasurement.findMany({
      where: {
        organizationId,
        ...(options?.metricType ? { metricType: options.metricType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  /**
   * 计算组织的总 Impact (按 metricType 聚合)
   */
  async calculateImpact(
    organizationId: string,
    metricType?: ImpactMetricType,
  ): Promise<{ totalRecords: number; metricTypes: string[] }> {
    const where: Record<string, unknown> = { organizationId }
    if (metricType) {
      where.metricType = metricType
    }

    const records = await prisma.impactMeasurement.findMany({
      where,
      select: { metricType: true },
    })

    const metricTypes = [...new Set(records.map((r) => r.metricType))]

    return {
      totalRecords: records.length,
      metricTypes,
    }
  },

  /**
   * 验证 Impact (标记为已验证)
   */
  async verify(
    id: string,
    organizationId: string,
  ): Promise<ImpactMeasurement | null> {
    const existing = await prisma.impactMeasurement.findFirst({
      where: { id, organizationId },
    })
    if (!existing) return null

    return prisma.impactMeasurement.update({
      where: { id },
      data: { verifiedAt: new Date() },
    })
  },
}
