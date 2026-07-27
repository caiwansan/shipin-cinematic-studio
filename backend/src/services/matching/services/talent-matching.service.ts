// ============================================================
// TalentMatchingService — 核心匹配计算引擎
// 职责：确定性匹配计算（Score + Breakdown + Evidence + Risk）
// 设计原则：
//   DP-M02 计算与解释分离 — LLM 负责解释，Service 负责计算
//   Constraint-2 Score 必须可测试 — 固定输入 → 固定输出
//
// ⚠️ 纯确定性计算，禁止 LLM 参与分数计算
// ============================================================

import { prisma } from '../../../utils/index.js';
import { talentMatchResultRepository } from '../repositories/talent-match-result.repository.js';
import { matchEvidenceRepository } from '../repositories/match-evidence.repository.js';

// ── 类型定义 ──

export interface MatchWeights {
  skill: number;
  experience: number;
  education: number;
  career: number;
}

export interface CandidateData {
  profileId: string;
  candidateId: string;
  yearsExperience: number;
  currentLevel: string | null;
  currentCity: string | null;
  currentCompany: string | null;
  openToOpportunity: boolean;
  careerDirection: string | null;
  industries: string[];
  skills: Array<{
    skillId: string;
    skillName: string;
    level: string;
    confidence: number;
  }>;
  workExperiences: Array<{
    id: string;
    company: string;
    title: string;
    startDate: Date;
    endDate: Date | null;
    isCurrent: boolean;
    location: string | null;
    skillsUsed: string[];
  }>;
  educations: Array<{
    id: string;
    school: string;
    degree: string | null;
    major: string | null;
  }>;
}

export interface JobRequirementData {
  id: string;
  requiredSkills: Array<{ skillId: string; skillName: string; minLevel?: string }>;
  preferredSkills?: Array<{ skillId: string; skillName: string }>;
  experienceMin: number;
  experienceMax?: number | null;
  educationMin?: string | null;
  preferredMajors?: string[];
  industries?: string[];
  location?: string | null;
  remoteOption?: string | null;
  weights?: MatchWeights | null;
}

export interface MatchResult {
  profileId: string;
  candidateId: string;
  score: number;
  breakdown: { skill: number; experience: number; education: number; career: number };
  matchedSkills: any[];
  missingSkills: any[];
  skillGap: any[];
  riskFlags: any[];
  evidence: EvidenceItem[];
}

export interface EvidenceItem {
  evidenceType: string;
  claim: string;
  sourceType: string;
  sourceId: string;
  confidence: number;
}

// ── 常量 ──

const DEFAULT_WEIGHTS: MatchWeights = {
  skill: 0.40,
  experience: 0.30,
  education: 0.15,
  career: 0.15,
};

const LEVEL_ORDER: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const DEGREE_ORDER: Record<string, number> = {
  高中: 1,
  大专: 2,
  本科: 3,
  硕士: 4,
  博士: 5,
  bachelor: 3,
  master: 4,
  phd: 5,
};

// ── 维度计算（纯函数，可独立测试）──

/**
 * 技能匹配计算
 * @returns 0-100 分数
 *
 * 公式：
 *   matched_required / total_required × 70
 *   + matched_preferred / total_preferred × 30
 *   最终 × 置信度加权
 */
export function calculateSkillMatch(
  candidateSkills: CandidateData['skills'],
  requiredSkills: JobRequirementData['requiredSkills'],
  preferredSkills: JobRequirementData['preferredSkills'] = [],
): { score: number; matched: any[]; missing: any[]; gap: any[] } {
  if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    return { score: 100, matched: [], missing: [], gap: [] };
  }

  const candidateSkillMap = new Map<string, CandidateData['skills'][0]>();
  for (const cs of candidateSkills) {
    candidateSkillMap.set(cs.skillId, cs);
    // 也按名称匹配（大小写不敏感）
    candidateSkillMap.set(cs.skillName.toLowerCase(), cs);
  }

  const matched: any[] = [];
  const missing: any[] = [];
  const gap: any[] = [];

  // Required skills 匹配
  let requiredScore = 0;
  for (const req of requiredSkills) {
    // 兼容两种格式：{skillId, skillName, minLevel} 和 {name, level}
    const reqSkillId = req.skillId || '';
    const reqSkillName = req.skillName || (req as any).name || '';
    const reqMinLevel = req.minLevel || (req as any).level || 'intermediate';
    const match = candidateSkillMap.get(reqSkillId) ||
                  candidateSkillMap.get(reqSkillName.toLowerCase());
    if (match) {
      // 基础分 100，按等级和置信度做适度扣减
      const levelOrder = LEVEL_ORDER[match.level] || 2;
      const requiredLevelOrder = LEVEL_ORDER[reqMinLevel] || 2;
      // 等级达标：不扣分；低一级：-15；低两级：-40
      const levelPenalty = levelOrder >= requiredLevelOrder ? 0 : (levelOrder >= requiredLevelOrder - 1 ? 15 : 40);
      // 置信度：>= 0.8 不扣分；0.5-0.8：-10；< 0.5：-20
      const confPenalty = match.confidence >= 0.8 ? 0 : (match.confidence >= 0.5 ? 10 : 20);
      const weightedScore = Math.max(0, 100 - levelPenalty - confPenalty);
      requiredScore += weightedScore;
      matched.push({
        skillId: match.skillId,
        skillName: match.skillName,
        level: match.level,
        confidence: match.confidence,
      });
    } else {
      missing.push({ skillId: reqSkillId, skillName: reqSkillName, importance: 'required' });
      gap.push({ skillName: reqSkillName, currentLevel: null, requiredLevel: reqMinLevel });
    }
  }

  const requiredAvg = requiredSkills.length > 0
    ? requiredScore / requiredSkills.length
    : 100;

  // Preferred skills 匹配
  let preferredScore = 0;
  for (const pref of preferredSkills) {
    // 兼容两种格式：{skillId, skillName} 和 {name, level}
    const prefSkillId = pref.skillId || '';
    const prefSkillName = pref.skillName || (pref as any).name || '';
    const match = candidateSkillMap.get(prefSkillId) ||
                  candidateSkillMap.get(prefSkillName.toLowerCase());
    if (match) {
      preferredScore += match.confidence * 100;
      matched.push({
        skillId: match.skillId,
        skillName: match.skillName,
        level: match.level,
        confidence: match.confidence,
      });
    } else {
      missing.push({ skillId: prefSkillId, skillName: prefSkillName, importance: 'preferred' });
    }
  }

  const preferredAvg = preferredSkills.length > 0
    ? preferredScore / preferredSkills.length
    : 100;

  // 加权合并
  const totalRequired = requiredSkills.length;
  const totalPreferred = preferredSkills.length;

  let score: number;
  if (totalRequired > 0 && totalPreferred > 0) {
    score = requiredAvg * 0.7 + preferredAvg * 0.3;
  } else if (totalRequired > 0) {
    score = requiredAvg;
  } else {
    score = preferredAvg;
  }

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    matched,
    missing,
    gap,
  };
}

/**
 * 经验匹配计算
 * @returns 0-100 分数
 */
export function calculateExperienceMatch(
  yearsExperience: number,
  industries: string[],
  workExperiences: CandidateData['workExperiences'],
  experienceMin: number,
  experienceMax: number | null | undefined,
  requiredIndustries: string[],
): { score: number; yearsScore: number; industryScore: number; levelScore: number } {
  // 年限得分（核心 60%）
  let yearsScore: number;
  if (experienceMin <= 0) {
    yearsScore = 100;
    // 无经验要求时，行业分和级别分也给满分
    const score = 100;
    return { score, yearsScore: 100, industryScore: 100, levelScore: 100 };
  } else {
    const ratio = yearsExperience / experienceMin;
    if (ratio >= 1.0) {
      // 超过要求，满分（但如果超太多，可能是 overqualified）
      yearsScore = Math.min(100, 80 + (ratio - 1) * 10);
    } else {
      // 不足要求
      yearsScore = ratio * 100;
    }
  }

  // 行业匹配（20%）
  let industryScore = 70; // 默认基础分
  if (requiredIndustries.length > 0 && industries.length > 0) {
    const matchCount = requiredIndustries.filter((ind) =>
      industries.some((ci) => ci.toLowerCase().includes(ind.toLowerCase()) ||
                                ind.toLowerCase().includes(ci.toLowerCase())),
    ).length;
    industryScore = Math.min(100, (matchCount / requiredIndustries.length) * 100);
  } else if (requiredIndustries.length === 0) {
    industryScore = 100; // 无行业要求，满分
  }

  // 级别匹配（20%）：从工作经历推断
  let levelScore = 60;
  if (workExperiences.length > 0 && experienceMin > 0) {
    // 根据工作年限推断级别
    if (yearsExperience >= experienceMin * 1.5) {
      levelScore = 90;
    } else if (yearsExperience >= experienceMin) {
      levelScore = 80;
    } else if (yearsExperience >= experienceMin * 0.7) {
      levelScore = 65;
    } else {
      levelScore = 40;
    }
  }

  const score = Math.round(yearsScore * 0.6 + industryScore * 0.2 + levelScore * 0.2);
  return { score: Math.min(100, Math.max(0, score)), yearsScore: Math.round(yearsScore), industryScore: Math.round(industryScore), levelScore: Math.round(levelScore) };
}

/**
 * 教育匹配计算
 * @returns 0-100 分数
 */
export function calculateEducationMatch(
  educations: CandidateData['educations'],
  educationMin?: string | null,
  preferredMajors?: string[] | null,
): { score: number; degreeScore: number; majorScore: number } {
  if (!educationMin && !preferredMajors?.length) {
    return { score: 70, degreeScore: 70, majorScore: 70 };
  }

  if (educations.length === 0) {
    return { score: 0, degreeScore: 0, majorScore: 0 };
  }

  // 找最高学历
  let highestDegree = 0;
  let highestEdu = educations[0];
  for (const edu of educations) {
    const order = DEGREE_ORDER[edu.degree || ''] || 0;
    if (order > highestDegree) {
      highestDegree = order;
      highestEdu = edu;
    }
  }

  // 学历得分（60%）
  let degreeScore = 50;
  if (educationMin) {
    const requiredOrder = DEGREE_ORDER[educationMin] || 3;
    if (highestDegree >= requiredOrder) {
      degreeScore = 100;
    } else if (highestDegree === requiredOrder - 1) {
      degreeScore = 60;
    } else {
      degreeScore = 20;
    }
  } else {
    degreeScore = 70;
  }

  // 专业得分（40%）
  let majorScore = 50;
  if (preferredMajors && preferredMajors.length > 0 && highestEdu.major) {
    const majorMatch = preferredMajors.some((pm) =>
      highestEdu.major!.toLowerCase().includes(pm.toLowerCase()) ||
      pm.toLowerCase().includes(highestEdu.major!.toLowerCase()),
    );
    majorScore = majorMatch ? 100 : 30;
  } else if (preferredMajors && preferredMajors.length > 0) {
    majorScore = 0;
  } else {
    majorScore = 70;
  }

  const score = Math.round(degreeScore * 0.6 + majorScore * 0.4);
  return { score: Math.min(100, Math.max(0, score)), degreeScore, majorScore };
}

/**
 * 职业匹配计算
 * @returns 0-100 分数
 */
export function calculateCareerMatch(
  careerDirection: string | null,
  currentCity: string | null,
  openToOpportunity: boolean,
  location?: string | null,
  remoteOption?: string | null,
): { score: number; directionScore: number; locationScore: number; availabilityScore: number } {
  // 方向匹配（50%）
  const directionScore = 70; // 默认中等（无明确方向时）

  // 地点匹配（25%）
  let locationScore = 60;
  if (!location) {
    locationScore = 70;
  } else if (currentCity) {
    if (currentCity.toLowerCase() === location.toLowerCase()) {
      locationScore = 100;
    } else if (remoteOption === 'remote' || remoteOption === 'hybrid') {
      locationScore = 70;
    } else {
      locationScore = 30;
    }
  }

  // 求职意愿（25%）
  const availabilityScore = openToOpportunity ? 100 : 50;

  const score = Math.round(directionScore * 0.5 + locationScore * 0.25 + availabilityScore * 0.25);
  return { score: Math.min(100, Math.max(0, score)), directionScore, locationScore, availabilityScore };
}

// ── 综合计算 ──

/**
 * 计算综合匹配分
 * 公式：Σ (dimension_score × dimension_weight)
 */
export function calculateOverallScore(
  breakdown: { skill: number; experience: number; education: number; career: number },
  weights: MatchWeights = DEFAULT_WEIGHTS,
): number {
  const score =
    breakdown.skill * weights.skill +
    breakdown.experience * weights.experience +
    breakdown.education * weights.education +
    breakdown.career * weights.career;
  return Math.round(Math.min(100, Math.max(0, score)));
}

// ── 风险标记 ──

function generateRiskFlags(
  breakdown: { skill: number; experience: number; education: number; career: number },
  candidate: CandidateData,
  requirement: JobRequirementData,
): any[] {
  const flags: any[] = [];

  if (breakdown.skill < 50) {
    flags.push({ type: 'skill_gap', severity: 'high', message: '核心技能缺失' });
  }

  if (breakdown.experience < 50) {
    flags.push({ type: 'experience_gap', severity: 'high', message: '经验明显不足' });
  }

  if (breakdown.education < 50) {
    flags.push({ type: 'education_gap', severity: 'medium', message: '学历差距' });
  }

  if (requirement.location && candidate.currentCity &&
      requirement.location !== candidate.currentCity &&
      requirement.remoteOption !== 'remote') {
    flags.push({ type: 'location_mismatch', severity: 'medium', message: '地点限制' });
  }

  if (!candidate.openToOpportunity) {
    flags.push({ type: 'not_open', severity: 'medium', message: '未开放求职' });
  }

  // 技能置信度检查
  const lowConfidenceSkills = candidate.skills.filter((s) => s.confidence < 0.5);
  if (candidate.skills.length > 0 && lowConfidenceSkills.length / candidate.skills.length > 0.5) {
    flags.push({ type: 'low_confidence', severity: 'medium', message: '技能证据不足' });
  }

  return flags;
}

// ── 证据生成 ──

function generateEvidence(
  candidate: CandidateData,
  breakdown: { skill: number; experience: number; education: number; career: number },
  skillResult: { matched: any[]; missing: any[] },
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  // 技能证据
  for (const matched of skillResult.matched) {
    // 找到对应的 candidate skill 以获取 skillId
    const cs = candidate.skills.find((s) => s.skillName === matched.skillName);
    if (cs) {
      evidence.push({
        evidenceType: 'skill_match',
        claim: `候选人具备 ${matched.skillName} 技能（${matched.level}，置信度 ${Math.round(matched.confidence * 100)}%）`,
        sourceType: 'candidate_skill',
        sourceId: cs.skillId,
        confidence: matched.confidence,
      });
    }
  }

  // 经验证据
  for (const exp of candidate.workExperiences) {
    evidence.push({
      evidenceType: 'experience_match',
      claim: `${exp.company} ${exp.title}（${exp.isCurrent ? '至今' : '过往'}）`,
      sourceType: 'work_experience',
      sourceId: exp.id,
      confidence: 0.7,
    });
  }

  // 教育证据
  for (const edu of candidate.educations) {
    evidence.push({
      evidenceType: 'education_match',
      claim: `${edu.school}${edu.degree ? ` · ${edu.degree}` : ''}${edu.major ? ` · ${edu.major}` : ''}`,
      sourceType: 'education',
      sourceId: edu.id,
      confidence: 0.9,
    });
  }

  return evidence;
}

// ── 主入口 ──

/**
 * 对单个候选人执行匹配计算
 * 纯确定性：相同输入 → 相同输出
 */
export function matchCandidate(
  candidate: CandidateData,
  requirement: JobRequirementData,
): MatchResult {
  const weights = requirement.weights || DEFAULT_WEIGHTS;

  // 1. 各维度计算
  const skillResult = calculateSkillMatch(
    candidate.skills,
    requirement.requiredSkills,
    requirement.preferredSkills,
  );

  const expResult = calculateExperienceMatch(
    candidate.yearsExperience,
    candidate.industries,
    candidate.workExperiences,
    requirement.experienceMin,
    requirement.experienceMax,
    requirement.industries || [],
  );

  const eduResult = calculateEducationMatch(
    candidate.educations,
    requirement.educationMin,
    requirement.preferredMajors,
  );

  const careerResult = calculateCareerMatch(
    candidate.careerDirection,
    candidate.currentCity,
    candidate.openToOpportunity,
    requirement.location,
    requirement.remoteOption,
  );

  const breakdown = {
    skill: skillResult.score,
    experience: expResult.score,
    education: eduResult.score,
    career: careerResult.score,
  };

  // 2. 综合分
  const score = calculateOverallScore(breakdown, weights);

  // 3. 风险标记
  const riskFlags = generateRiskFlags(breakdown, candidate, requirement);

  // 4. 证据生成
  const evidence = generateEvidence(candidate, breakdown, skillResult);

  return {
    profileId: candidate.profileId,
    candidateId: candidate.candidateId,
    score,
    breakdown,
    matchedSkills: skillResult.matched,
    missingSkills: skillResult.missing,
    skillGap: skillResult.gap,
    riskFlags,
    evidence,
  };
}

// ── 从数据库加载候选人数据 ──

async function loadCandidateData(profileId: string): Promise<CandidateData> {
  const profile = await prisma.careerProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    throw new Error(`Career Profile not found: ${profileId}`);
  }

  const [workExperiences, educations, candidateSkills] = await Promise.all([
    prisma.workExperience.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    }),
    prisma.education.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    }),
    prisma.candidateSkill.findMany({
      where: { profileId },
      include: { skill: true },
      orderBy: { confidence: 'desc' },
    }),
  ]);

  // 计算工作年限
  let yearsExperience = profile.yearsExperience || 0;
  if (yearsExperience === 0 && workExperiences.length > 0) {
    let earliest: Date | null = null;
    for (const exp of workExperiences) {
      if (exp.startDate) {
        const start = new Date(exp.startDate);
        if (!earliest || start < earliest) {
          earliest = start;
        }
      }
    }
    if (earliest) {
      const now = new Date();
      yearsExperience = Math.floor((now.getTime() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }

  return {
    profileId: profile.id,
    candidateId: profile.candidateId,
    yearsExperience,
    currentLevel: profile.currentLevel,
    currentCity: profile.city,
    currentCompany: null, // 从 Card 投影获取
    openToOpportunity: profile.openToOpportunity,
    careerDirection: profile.careerDirection,
    industries: profile.industry ? [profile.industry] : [],
    skills: candidateSkills.map((cs: any) => ({
      skillId: cs.skillId,
      skillName: cs.skill?.name || '',
      level: cs.level,
      confidence: cs.confidence || 0,
    })),
    workExperiences: workExperiences.map((we: any) => ({
      id: we.id,
      company: we.company,
      title: we.title,
      startDate: we.startDate,
      endDate: we.endDate,
      isCurrent: we.isCurrent,
      location: we.location,
      skillsUsed: we.skillsUsed,
    })),
    educations: educations.map((ed: any) => ({
      id: ed.id,
      school: ed.school,
      degree: ed.degree,
      major: ed.major,
    })),
  };
}

// ── 服务层：持久化 ──

export const talentMatchingService = {
  /**
   * 对单个候选人执行匹配并持久化结果
   */
  async matchAndPersist(
    profileId: string,
    requirement: JobRequirementData,
  ): Promise<MatchResult> {
    // 1. 加载候选人数据
    const candidate = await loadCandidateData(profileId);

    // 2. 执行匹配计算
    const result = matchCandidate(candidate, requirement);

    // 3. 持久化匹配结果
    const matchResult = await talentMatchResultRepository.create({
      jobRequirementId: requirement.id,
      candidateId: result.candidateId,
      profileId: result.profileId,
      score: result.score,
      breakdown: result.breakdown,
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      skillGap: result.skillGap,
      riskFlags: result.riskFlags,
      matchVersion: 'v1',
    });

    // 4. 持久化证据
    if (result.evidence.length > 0) {
      await matchEvidenceRepository.createMany(
        result.evidence.map((e) => ({
          matchResultId: matchResult!.id,
          evidenceType: e.evidenceType,
          claim: e.claim,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          confidence: e.confidence,
        })),
      );
    }

    return result;
  },

  /**
   * 批量匹配多个候选人
   */
  async matchBatch(
    profileIds: string[],
    requirement: JobRequirementData,
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const profileId of profileIds) {
      try {
        const result = await this.matchAndPersist(profileId, requirement);
        results.push(result);
      } catch (e: any) {
        // 跳过加载失败的候选人，继续处理
        console.error(`[Matching] Failed to match profile ${profileId}: ${e.message}`);
      }
    }

    // 按分数排序并写入排名
    results.sort((a, b) => b.score - a.score);

    // 更新排名（需要持久化后的 ID）
    // 注意：排名在 listByJobRequirement 时动态计算更高效
    // 这里返回排序后的结果

    return results;
  },

  /**
   * 获取匹配结果（含证据）
   */
  async getMatchResultWithEvidence(matchResultId: string) {
    const result = await talentMatchResultRepository.getById(matchResultId);
    if (!result) return null;

    const evidence = await matchEvidenceRepository.listByMatchResult(matchResultId);

    return {
      ...result,
      evidence,
    };
  },
};
