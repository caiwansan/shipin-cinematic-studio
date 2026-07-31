/**
 * simple-match.adapter.ts — 简版候选人 → 统一匹配引擎适配器
 *
 * Sprint-RECRUITMENT-REALITY-02 Task 04:
 * 消除三套匹配算法并存（talent-matching / recruit-agent / search-agent）
 * 唯一计算引擎: talent-matching.service.ts 的 matchCandidate（权重 0.40/0.30/0.15/0.15）
 * LLM 只负责解释，不参与排名计算。
 *
 * 本适配器将招聘工作台的「简版候选人」（字符串 skills/experience/city/education）
 * 映射为统一引擎的 CandidateData / JobRequirementData，保证所有入口分数一致。
 */

import {
  matchCandidate,
  CandidateData,
  JobRequirementData,
  MatchResult,
  MatchWeights,
} from './services/talent-matching.service.js'

// ── 简版输入类型（招聘工作台现有结构） ──

export interface SimpleCandidate {
  id: string
  name?: string
  skills: string[]
  experience?: string
  experienceYears?: number
  city?: string
  education?: string
  careerGoal?: string
  salaryMin?: number
  salaryMax?: number
}

export interface SimpleJobRequirement {
  jobId: string
  jobSkills: string[]
  experienceMin?: number
  location?: string
  educationMin?: string
  weights?: MatchWeights | null
}

// ── 适配器：简版候选人 → CandidateData ──

export function toCandidateData(c: SimpleCandidate): CandidateData {
  const skills = (c.skills || [])
    .filter(s => s && s.trim())
    .map(name => ({
      skillId: name.toLowerCase(),
      skillName: name,
      level: 'intermediate' as const,
      confidence: 0.8,
    }))

  const workExperiences: CandidateData['workExperiences'] = c.experience
    ? [{
        id: c.id,
        company: '',
        title: c.experience,
        startDate: new Date('2000-01-01'),
        endDate: null,
        isCurrent: true,
        location: c.city || null,
        skillsUsed: skills.map(s => s.skillName),
      }]
    : []

  const educations: CandidateData['educations'] = c.education
    ? [{
        id: c.id,
        school: '',
        degree: c.education,
        major: null,
      }]
    : []

  return {
    profileId: c.id,
    candidateId: c.id,
    yearsExperience: c.experienceYears || (c.experience ? 3 : 0),
    currentLevel: null,
    currentCity: c.city || null,
    currentCompany: null,
    openToOpportunity: true,
    careerDirection: c.careerGoal || null,
    industries: [],
    skills,
    workExperiences,
    educations,
  }
}

// ── 适配器：简版岗位要求 → JobRequirementData ──

export function toJobRequirement(req: SimpleJobRequirement): JobRequirementData {
  const requiredSkills = (req.jobSkills || [])
    .filter(s => s && s.trim())
    .map(name => ({ skillId: name.toLowerCase(), skillName: name, minLevel: 'intermediate' }))

  return {
    id: req.jobId,
    requiredSkills,
    preferredSkills: [],
    experienceMin: req.experienceMin || 0,
    educationMin: req.educationMin || null,
    location: req.location || null,
    weights: req.weights || null,
  }
}

// ── 统一入口：匹配单个候选人 ──

export function matchSimpleCandidate(
  candidate: SimpleCandidate,
  req: SimpleJobRequirement,
): MatchResult {
  return matchCandidate(toCandidateData(candidate), toJobRequirement(req))
}

// ── 统一入口：批量匹配（按分数降序） ──

export function matchSimpleCandidates(
  candidates: SimpleCandidate[],
  req: SimpleJobRequirement,
): MatchResult[] {
  return candidates
    .map(c => matchSimpleCandidate(c, req))
    .sort((a, b) => b.score - a.score)
}

// ── 维度中文标签（供 reasons/breakdown 展示） ──

export const DIMENSION_LABELS: Record<keyof MatchResult['breakdown'], string> = {
  skill: '技能',
  experience: '经验',
  education: '学历',
  career: '方向',
}
