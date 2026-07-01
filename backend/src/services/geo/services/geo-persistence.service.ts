// ============================================================
// GEO Persistence Service — Save/Load Discovery, Action Plan, Verification
// ============================================================
// P1-A: Persistence Layer for GEO Benchmark modules
// Each save creates a new record (preserves history).
// Each get returns the latest record.
//
// Now delegates all Prisma operations to GEOReportRepository.
// ============================================================

import { geoReportRepository } from '../repositories/GEOReportRepository'
import type {
  PersistedDiscoveryReport,
  PersistedActionPlan,
  PersistedVerificationReport,
  HistoryItem,
} from '../repositories/GEOReportRepository'

// Re-export types for consumers
export type {
  PersistedDiscoveryReport,
  PersistedActionPlan,
  PersistedVerificationReport,
  HistoryItem,
}

export const geoPersistenceService = {
  // ─── Discovery Report ───

  async saveDiscoveryReport(
    projectId: string,
    entityName: string,
    report: { adi: number; coverageScore: number; shareScore: number; positionScore: number; reportData: any }
  ): Promise<PersistedDiscoveryReport> {
    return geoReportRepository.saveDiscoveryReport(projectId, entityName, report)
  },

  async getDiscoveryReport(projectId: string): Promise<PersistedDiscoveryReport | null> {
    return geoReportRepository.getDiscoveryReport(projectId)
  },

  // ─── Action Plan ───

  async saveActionPlan(
    projectId: string,
    planData: any,
    discoveryReportId?: string
  ): Promise<PersistedActionPlan> {
    return geoReportRepository.saveActionPlan(projectId, planData, discoveryReportId)
  },

  async getActionPlan(projectId: string): Promise<PersistedActionPlan | null> {
    return geoReportRepository.getActionPlan(projectId)
  },

  // ─── Verification Report ───

  async saveVerificationReport(
    projectId: string,
    entityName: string,
    report: { beforeAdi: number; afterAdi: number; deltaAdi: number; reportData: any }
  ): Promise<PersistedVerificationReport> {
    return geoReportRepository.saveVerificationReport(projectId, entityName, report)
  },

  async getVerificationReport(projectId: string): Promise<PersistedVerificationReport | null> {
    return geoReportRepository.getVerificationReport(projectId)
  },

  // ─── History ───

  async listHistory(projectId: string): Promise<HistoryItem[]> {
    return geoReportRepository.listHistory(projectId)
  },
}
