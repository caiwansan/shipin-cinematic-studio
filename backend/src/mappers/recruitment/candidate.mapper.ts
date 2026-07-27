/**
 * candidate.mapper.ts — Candidate (Identity) → CandidateDTO 映射
 */

export interface CandidateDTO {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  experienceYears: number | null
  expectedSalary: string | null
  careerGoal: string | null
  skills: string[]
  education: string | null
  qualityScore: number | null
  status: string | null
  summary: string | null
  completeness: number | null
  matchCount: number
  createdAt: Date
  updatedAt: Date
}

export function formatSalaryRange(salaryMin: number | null, salaryMax: number | null): string | null {
  if (salaryMin == null && salaryMax == null) return null
  if (salaryMin != null && salaryMax != null) return `${salaryMin}-${salaryMax}K`
  if (salaryMin != null) return `${salaryMin}K+`
  return `≤${salaryMax}K`
}

export function mapCandidateToDTO(row: any): CandidateDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    experienceYears: row.experienceYears,
    expectedSalary: formatSalaryRange(row.salaryMin, row.salaryMax),
    careerGoal: row.careerGoal,
    skills: row.skills,
    education: row.education,
    qualityScore: row.qualityScore ?? null,
    status: row.status ?? null,
    summary: row.summary ?? null,
    completeness: row.completeness ?? null,
    matchCount: row.matchCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapCandidateListToDTOList(rows: any[]): CandidateDTO[] {
  return rows.map(mapCandidateToDTO)
}
