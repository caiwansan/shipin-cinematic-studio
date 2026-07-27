/**
 * job.mapper.ts — JobPosting → JobDTO 映射
 *
 * AR-01 Phase 1: Infrastructure
 * DP-4: Mapper 是唯一允许跨 Domain 组装数据的地方。
 */

export interface JobDTO {
  id: string
  title: string
  description: string | null
  location: string | null
  department: string | null
  status: string
  requiredSkills: string[]
  experienceMin: number | null
  experienceMax: number | null
  salaryMin: number | null
  salaryMax: number | null
  matchRate: number
  createdAt: Date
  updatedAt: Date
  enterprise: { id: string; name: string } | null
  _count: { candidates: number; interviews: number; pipelines: number }
}

/**
 * 将 Prisma JobPosting 映射为 JobDTO
 */
export function mapJobToDTO(row: any): JobDTO {
  const candidateCount = row._count?.candidateMatches ?? 0
  // 简化的匹配率计算：基于候选人数量 / (候选人数量 + 10) * 100
  const matchRate = Math.min(95, Math.round((candidateCount / (candidateCount + 10)) * 100))

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    department: row.department ?? null,
    status: row.status,
    requiredSkills: row.requiredSkills ?? [],
    experienceMin: row.experienceMin ?? null,
    experienceMax: row.experienceMax ?? null,
    salaryMin: row.salaryMin ?? null,
    salaryMax: row.salaryMax ?? null,
    matchRate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    enterprise: row.enterprise ?? null,
    _count: {
      candidates: row._count?.candidateMatches ?? 0,
      interviews: row._count?.interviewSessions ?? 0,
      pipelines: row._count?.pipelineSteps ?? 0,
    },
  }
}

export function mapJobListToDTOList(rows: any[]): JobDTO[] {
  return rows.map(mapJobToDTO)
}
