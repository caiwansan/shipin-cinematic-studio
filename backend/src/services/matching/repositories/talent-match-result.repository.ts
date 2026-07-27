// ============================================================
// TalentMatchResultRepository — 匹配结果（Computed Data）
// 职责：管理 TalentMatchResult 的 CRUD
// 数据性质：Computed，可重算、可删除、不影响事实数据
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface MatchResultDTO {
  id: string;
  jobRequirementId: string;
  candidateId: string;
  profileId: string;
  score: number;
  breakdown: any;
  matchedSkills: any;
  missingSkills: any;
  skillGap: any | null;
  riskFlags: any | null;
  reasoning: string | null;
  reasoningAt: string | null;
  rank: number | null;
  rankingVersion: string | null;
  matchVersion: string;
  createdAt: string | null;
}

export interface CreateMatchResultInput {
  jobRequirementId: string;
  candidateId: string;
  profileId: string;
  score: number;
  breakdown: Record<string, number>;
  matchedSkills: any[];
  missingSkills: any[];
  skillGap?: any[];
  riskFlags?: any[];
  reasoning?: string;
  matchVersion?: string;
  rank?: number;
}

function toDTO(record: any): MatchResultDTO | null {
  if (!record) return null;
  return {
    id: record.id,
    jobRequirementId: record.jobRequirementId,
    candidateId: record.candidateId,
    profileId: record.profileId,
    score: record.score,
    breakdown: record.breakdown,
    matchedSkills: record.matchedSkills,
    missingSkills: record.missingSkills,
    skillGap: record.skillGap ?? null,
    riskFlags: record.riskFlags ?? null,
    reasoning: record.reasoning ?? null,
    reasoningAt: record.reasoningAt?.toISOString() ?? null,
    rank: record.rank ?? null,
    rankingVersion: record.rankingVersion ?? null,
    matchVersion: record.matchVersion,
    createdAt: record.createdAt?.toISOString() ?? null,
  };
}

export const talentMatchResultRepository = {
  /**
   * 创建匹配结果
   */
  async create(input: CreateMatchResultInput) {
    const record = await prisma.talentMatchResult.create({
      data: {
        jobRequirementId: input.jobRequirementId,
        candidateId: input.candidateId,
        profileId: input.profileId,
        score: input.score,
        breakdown: input.breakdown as any,
        matchedSkills: input.matchedSkills as any,
        missingSkills: input.missingSkills as any,
        skillGap: (input.skillGap ?? null) as any,
        riskFlags: (input.riskFlags ?? null) as any,
        reasoning: input.reasoning ?? null,
        reasoningAt: input.reasoning ? new Date() : null,
        matchVersion: input.matchVersion ?? 'v1',
        rank: input.rank ?? null,
      },
    });
    return toDTO(record);
  },

  /**
   * 通过 ID 获取匹配结果
   */
  async getById(id: string): Promise<MatchResultDTO | null> {
    const record = await prisma.talentMatchResult.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 获取某岗位的所有匹配结果（按分数降序）
   */
  async listByJobRequirement(jobRequirementId: string, minScore?: number, limit?: number) {
    const records = await prisma.talentMatchResult.findMany({
      where: {
        jobRequirementId,
        ...(minScore !== undefined ? { score: { gte: minScore } } : {}),
      },
      orderBy: { score: 'desc' },
      ...(limit !== undefined ? { take: limit } : {}),
    });
    return records.map(toDTO).filter((r): r is MatchResultDTO => r !== null);
  },

  /**
   * 获取某候选人的所有匹配记录
   */
  async listByCandidate(candidateId: string) {
    const records = await prisma.talentMatchResult.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDTO).filter((r): r is MatchResultDTO => r !== null);
  },

  /**
   * 更新排名（批量计算后写入）
   */
  async updateRank(id: string, rank: number, rankingVersion?: string) {
    const record = await prisma.talentMatchResult.update({
      where: { id },
      data: { rank, ...(rankingVersion ? { rankingVersion } : {}) },
    });
    return toDTO(record);
  },

  /**
   * 更新 LLM 解释
   */
  async updateReasoning(id: string, reasoning: string) {
    const record = await prisma.talentMatchResult.update({
      where: { id },
      data: { reasoning, reasoningAt: new Date() },
    });
    return toDTO(record);
  },

  /**
   * 删除某岗位的所有匹配结果（重算时调用）
   */
  async deleteByJobRequirement(jobRequirementId: string) {
    await prisma.talentMatchResult.deleteMany({
      where: { jobRequirementId },
    });
  },

  /**
   * 删除单条匹配结果
   */
  async delete(id: string) {
    await prisma.talentMatchResult.delete({ where: { id } });
  },
};
