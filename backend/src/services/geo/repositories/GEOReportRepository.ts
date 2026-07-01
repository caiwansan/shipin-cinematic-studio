// ============================================================
// GEO Report Repository — CRUD for GEODiscoveryReport / GEOActionPlan / GEOVerificationReport
// ============================================================
// P1-A: Persistence Layer for GEO Benchmark modules
// Replaces direct PrismaClient usage in geo-persistence.service.ts

import { prisma } from '../../../utils/index'

/** Mapped discovery report returned to callers */
export interface PersistedDiscoveryReport {
  id: string
  projectId: string
  entityName: string
  adi: number
  coverageScore: number
  shareScore: number
  positionScore: number
  reportData: any
  createdAt: string
  updatedAt: string
}

/** Mapped action plan returned to callers */
export interface PersistedActionPlan {
  id: string
  projectId: string
  discoveryReportId: string | null
  planData: any
  status: string
  createdAt: string
  updatedAt: string
}

/** Mapped verification report returned to callers */
export interface PersistedVerificationReport {
  id: string
  projectId: string
  entityName: string
  beforeAdi: number
  afterAdi: number
  deltaAdi: number
  reportData: any
  createdAt: string
}

/** History item combining all report types */
export interface HistoryItem {
  type: 'discovery' | 'action_plan' | 'verification'
  id: string
  projectId: string
  entityName?: string
  createdAt: string
  summary: string
}

function mapDiscovery(d: any): PersistedDiscoveryReport {
  return {
    id: d.id,
    projectId: d.projectId,
    entityName: d.entityName,
    adi: d.adi,
    coverageScore: d.coverageScore,
    shareScore: d.shareScore,
    positionScore: d.positionScore,
    reportData: d.reportData,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

function mapActionPlan(a: any): PersistedActionPlan {
  return {
    id: a.id,
    projectId: a.projectId,
    discoveryReportId: a.discoveryReportId || null,
    planData: a.planData,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

function mapVerification(v: any): PersistedVerificationReport {
  return {
    id: v.id,
    projectId: v.projectId,
    entityName: v.entityName,
    beforeAdi: v.beforeAdi,
    afterAdi: v.afterAdi,
    deltaAdi: v.deltaAdi,
    reportData: v.reportData,
    createdAt: v.createdAt.toISOString(),
  }
}

export const geoReportRepository = {
  // ─── Discovery Report ───

  async saveDiscoveryReport(
    projectId: string,
    entityName: string,
    report: { adi: number; coverageScore: number; shareScore: number; positionScore: number; reportData: any }
  ): Promise<PersistedDiscoveryReport> {
    const record = await prisma.gEODiscoveryReport.create({
      data: {
        projectId,
        entityName,
        adi: report.adi,
        coverageScore: report.coverageScore,
        shareScore: report.shareScore,
        positionScore: report.positionScore,
        reportData: report.reportData,
      },
    })
    return mapDiscovery(record)
  },

  async getDiscoveryReport(projectId: string): Promise<PersistedDiscoveryReport | null> {
    const record = await prisma.gEODiscoveryReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) return null
    return mapDiscovery(record)
  },

  // ─── Action Plan ───

  async saveActionPlan(
    projectId: string,
    planData: any,
    discoveryReportId?: string
  ): Promise<PersistedActionPlan> {
    const record = await prisma.gEOActionPlan.create({
      data: {
        projectId,
        discoveryReportId: discoveryReportId || null,
        planData,
        status: 'draft',
      },
    })
    return mapActionPlan(record)
  },

  async getActionPlan(projectId: string): Promise<PersistedActionPlan | null> {
    const record = await prisma.gEOActionPlan.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) return null
    return mapActionPlan(record)
  },

  // ─── Verification Report ───

  async saveVerificationReport(
    projectId: string,
    entityName: string,
    report: { beforeAdi: number; afterAdi: number; deltaAdi: number; reportData: any }
  ): Promise<PersistedVerificationReport> {
    const record = await prisma.gEOVerificationReport.create({
      data: {
        projectId,
        entityName,
        beforeAdi: report.beforeAdi,
        afterAdi: report.afterAdi,
        deltaAdi: report.deltaAdi,
        reportData: report.reportData,
      },
    })
    return mapVerification(record)
  },

  async getVerificationReport(projectId: string): Promise<PersistedVerificationReport | null> {
    const record = await prisma.gEOVerificationReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) return null
    return mapVerification(record)
  },

  // ─── History ───

  async listHistory(projectId: string): Promise<HistoryItem[]> {
    const [discoveries, actionPlans, verifications] = await Promise.all([
      prisma.gEODiscoveryReport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.gEOActionPlan.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.gEOVerificationReport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const items: HistoryItem[] = [
      ...discoveries.map((d) => ({
        type: 'discovery' as const,
        id: d.id,
        projectId: d.projectId,
        entityName: d.entityName,
        createdAt: d.createdAt.toISOString(),
        summary: `Discovery: ${d.entityName} (ADI: ${d.adi})`,
      })),
      ...actionPlans.map((a) => ({
        type: 'action_plan' as const,
        id: a.id,
        projectId: a.projectId,
        createdAt: a.createdAt.toISOString(),
        summary: `Action Plan: ${(a.planData as any)?.summary || `${a.status}`}`,
      })),
      ...verifications.map((v) => ({
        type: 'verification' as const,
        id: v.id,
        projectId: v.projectId,
        entityName: v.entityName,
        createdAt: v.createdAt.toISOString(),
        summary: `Verification: ${v.entityName} (${v.beforeAdi} → ${v.afterAdi}, Δ${v.deltaAdi})`,
      })),
    ]

    // Sort by createdAt desc (newest first)
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return items
  },
}
