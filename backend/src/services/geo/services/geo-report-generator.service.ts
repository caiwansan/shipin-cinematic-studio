// ============================================================
// GEO Report Generator — 基于实际数据生成报告
// Sprint 4 Data Integration
//
// 不单独建 Report 表。报告是实时计算的视图。
// ============================================================

import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoEntityRepository } from '../repositories/geo-entity.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoClaimRepository } from '../repositories/geo-claim.repository.js'
import { knowledgeObjectRepository } from '../../repositories/knowledge-object.repository.js'

interface ReportSection {
  title: string
  content: string
  type: string
}

interface GeneratedReport {
  id: string
  projectId: string
  type: string
  title: string
  summary: string
  sections: ReportSection[]
  generatedAt: string
}

export const geoReportGenerator = {
  /**
   * 生成品牌报告 — 基于品牌信息、扫描数据
   */
  async generateBrandReport(projectId: string): Promise<GeneratedReport> {
    const project = await geoProjectRepository.findUnique({ where: { id: projectId } })
    const entities = await geoEntityRepository.findMany({ where: { projectId } })
    const scans = await geoScanHistoryRepository.findMany(
      { where: { projectId } },
      { startedAt: 'desc' }
    )
    const recentScans = Array.isArray(scans) ? scans.slice(0, 5) : []

    const sections: ReportSection[] = [
      {
        title: '项目概览',
        content: `项目名称: ${project?.name || '-'}\n状态: ${project?.status || '-'}\n描述: ${project?.topic || '无'}`,
        type: 'overview',
      },
      {
        title: '实体分析',
        content: `共发现 ${entities.length} 个实体`,
        type: 'entity',
      },
      {
        title: '扫描历史',
        content: recentScans.length > 0
          ? recentScans.map((s: any) => `[${s.scanType}] ${s.status} — ${(s.completedAt || s.createdAt || '').split('T')[0]}`).join('\n')
          : '暂无扫描记录',
        type: 'scan',
      },
    ]

    return {
      id: `br-${projectId}-${Date.now()}`,
      projectId,
      type: 'brand',
      title: `品牌报告 — ${project?.name || projectId}`,
      summary: `${entities.length} 个实体，${recentScans.length} 次扫描`,
      sections,
      generatedAt: new Date().toISOString(),
    }
  },

  /**
   * 生成知识报告 — 基于 Knowledge Objects、实体
   */
  async generateKnowledgeReport(projectId: string): Promise<GeneratedReport> {
    const kos = await knowledgeObjectRepository.findMany({ projectId })
    const entities = await geoEntityRepository.findMany({ where: { projectId } })

    const sections: ReportSection[] = [
      {
        title: '知识总量',
        content: `Knowledge Objects: ${kos.length}\n实体数量: ${entities.length}`,
        type: 'summary',
      },
      {
        title: '知识对象列表',
        content: kos.length > 0
          ? kos.map((k: any) => `- ${k.title || k.topic || '未命名'} (${k.status})`).join('\n')
          : '暂无知识对象',
        type: 'list',
      },
    ]

    return {
      id: `kr-${projectId}-${Date.now()}`,
      projectId,
      type: 'knowledge',
      title: '知识报告',
      summary: `${kos.length} 个 KO，${entities.length} 个实体`,
      sections,
      generatedAt: new Date().toISOString(),
    }
  },

  /**
   * 生成证据报告
   */
  async generateEvidenceReport(projectId: string): Promise<GeneratedReport> {
    const claims = await geoClaimRepository.findMany({
      entity: { projectId },
    }, { include: { evidences: true } })

    const totalEvidence = claims.reduce((sum: number, c: any) => sum + (c.evidences?.length || 0), 0)
    const avgCredibility = claims.length > 0
      ? claims.reduce((sum: number, c: any) => {
          const evAvg = c.evidences && c.evidences.length > 0
            ? c.evidences.reduce((es: number, e: any) => es + e.credibilityScore, 0) / c.evidences.length
            : 0
          return sum + evAvg
        }, 0) / claims.length
      : 0

    const sections: ReportSection[] = [
      {
        title: '证据统计',
        content: `Claims: ${claims.length}\nEvidence: ${totalEvidence}\n平均可信度: ${(avgCredibility * 100).toFixed(1)}%`,
        type: 'stats',
      },
      {
        title: '可信度分布',
        content: claims.length > 0
          ? claims.map((c: any) => `- "${c.text.substring(0, 50)}..." → ${c.evidences?.length || 0} 条证据`).join('\n')
          : '暂无数据',
        type: 'distribution',
      },
    ]

    return {
      id: `er-${projectId}-${Date.now()}`,
      projectId,
      type: 'evidence',
      title: '证据报告',
      summary: `${claims.length} 条 Claim，${totalEvidence} 条 Evidence，平均可信度 ${(avgCredibility * 100).toFixed(1)}%`,
      sections,
      generatedAt: new Date().toISOString(),
    }
  },

  /**
   * 生成执行摘要 — 聚合全项目数据
   */
  async generateExecutiveSummary(projectId: string): Promise<GeneratedReport> {
    const [project, entities, claims, kos, scans] = await Promise.all([
      geoProjectRepository.findUnique({ where: { id: projectId } }),
      geoEntityRepository.findMany({ where: { projectId } }),
      geoClaimRepository.findMany({ entity: { projectId } }),
      knowledgeObjectRepository.findMany({ projectId }),
      geoScanHistoryRepository.findMany(
        { where: { projectId } },
        { startedAt: 'desc' }
      ),
    ])

    const claimArray = Array.isArray(claims) ? claims : []
    const scanArray = Array.isArray(scans) ? scans : []

    const sections: ReportSection[] = [
      {
        title: '项目摘要',
        content: `名称: ${project?.name || '-'}\n状态: ${project?.status || '-'}\n创建: ${project?.createdAt?.split('T')[0] || '-'}`,
        type: 'summary',
      },
      {
        title: '实体',
        content: `共 ${entities.length} 个实体`,
        type: 'count',
      },
      {
        title: 'Claim & Evidence',
        content: `Claims: ${claimArray.length}`,
        type: 'quality',
      },
      {
        title: '知识 & 扫描',
        content: `Knowledge Objects: ${kos.length}\n扫描次数: ${scanArray.length}`,
        type: 'activities',
      },
    ]

    return {
      id: `es-${projectId}-${Date.now()}`,
      projectId,
      type: 'executive',
      title: `执行摘要 — ${project?.name || projectId}`,
      summary: `${entities.length} 实体 · ${claimArray.length} Claim · ${kos.length} KO · ${scanArray.length} 次扫描`,
      sections,
      generatedAt: new Date().toISOString(),
    }
  },

  /**
   * 获取项目的所有报告类型
   */
  async listAvailableTypes(projectId: string): Promise<{ type: string; label: string }[]> {
    return [
      { type: 'brand', label: '品牌报告' },
      { type: 'knowledge', label: '知识报告' },
      { type: 'evidence', label: '证据报告' },
      { type: 'executive', label: '执行摘要' },
    ]
  },

  /**
   * 按类型生成报告
   */
  async generate(projectId: string, type: string): Promise<GeneratedReport | null> {
    switch (type) {
      case 'brand': return this.generateBrandReport(projectId)
      case 'knowledge': return this.generateKnowledgeReport(projectId)
      case 'evidence': return this.generateEvidenceReport(projectId)
      case 'executive': return this.generateExecutiveSummary(projectId)
      default: return null
    }
  },
}
