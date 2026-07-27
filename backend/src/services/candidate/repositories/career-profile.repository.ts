// ============================================================
// CareerProfileRepository — 唯一真实档案（SSOT）
// 职责：管理 CareerProfile 的创建和读取
// 设计原则：DP-P3-01 SSOT · DP-P3-05 唯一档案
// ============================================================

import { prisma } from '../../../utils/index.js';
import { randomUUID } from 'crypto';

export interface CreateCareerProfileInput {
  userId: string;
  fullName: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  careerDirection?: string;
  industry?: string;
  yearsExperience?: number;
  currentLevel?: string;
}

export interface UpdateCareerProfileInput {
  fullName?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  careerDirection?: string;
  industry?: string;
  yearsExperience?: number;
  currentLevel?: string;
  jobSeekingStatus?: string;
  openToOpportunity?: boolean;
  visibility?: string;
  completionScore?: number;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    candidateId: record.candidateId,
    userId: record.userId,
    fullName: record.fullName,
    headline: record.headline ?? null,
    bio: record.bio ?? null,
    avatarUrl: record.avatarUrl ?? null,
    email: record.email ?? null,
    phone: record.phone ?? null,
    city: record.city ?? null,
    country: record.country,
    careerDirection: record.careerDirection ?? null,
    industry: record.industry ?? null,
    yearsExperience: record.yearsExperience,
    currentLevel: record.currentLevel ?? null,
    jobSeekingStatus: record.jobSeekingStatus,
    openToOpportunity: record.openToOpportunity,
    visibility: record.visibility,
    completionScore: record.completionScore,
    lastActiveAt: record.lastActiveAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const careerProfileRepository = {
  /**
   * 创建职业档案
   * 一个 User 只能有一个 CareerProfile（userId 唯一约束）
   */
  async create(input: CreateCareerProfileInput) {
    const record = await prisma.careerProfile.create({
      data: {
        candidateId: randomUUID(),
        userId: input.userId,
        fullName: input.fullName,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        country: input.country ?? 'CN',
        careerDirection: input.careerDirection ?? null,
        industry: input.industry ?? null,
        yearsExperience: input.yearsExperience ?? 0,
        currentLevel: input.currentLevel ?? null,
      },
    });
    return toDTO(record);
  },

  /**
   * 通过 userId 获取档案
   */
  async getByUserId(userId: string) {
    const record = await prisma.careerProfile.findUnique({
      where: { userId },
    });
    return toDTO(record);
  },

  /**
   * 通过 candidateId 获取档案
   */
  async getByCandidateId(candidateId: string) {
    const record = await prisma.careerProfile.findUnique({
      where: { candidateId },
    });
    return toDTO(record);
  },

  /**
   * 通过 profile 主键获取档案
   */
  async getById(id: string) {
    const record = await prisma.careerProfile.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 更新档案
   */
  async update(id: string, input: UpdateCareerProfileInput) {
    const record = await prisma.careerProfile.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.headline !== undefined && { headline: input.headline }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.careerDirection !== undefined && { careerDirection: input.careerDirection }),
        ...(input.industry !== undefined && { industry: input.industry }),
        ...(input.yearsExperience !== undefined && { yearsExperience: input.yearsExperience }),
        ...(input.currentLevel !== undefined && { currentLevel: input.currentLevel }),
        ...(input.jobSeekingStatus !== undefined && { jobSeekingStatus: input.jobSeekingStatus }),
        ...(input.openToOpportunity !== undefined && { openToOpportunity: input.openToOpportunity }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.completionScore !== undefined && { completionScore: input.completionScore }),
        lastActiveAt: new Date(),
      },
    });
    return toDTO(record);
  },

  /**
   * 更新求职状态
   */
  async updateJobSeekingStatus(id: string, status: string, openToOpportunity?: boolean) {
    const record = await prisma.careerProfile.update({
      where: { id },
      data: {
        jobSeekingStatus: status,
        ...(openToOpportunity !== undefined && { openToOpportunity }),
        lastActiveAt: new Date(),
      },
    });
    return toDTO(record);
  },

  /**
   * 更新可见性
   */
  async updateVisibility(id: string, visibility: string) {
    const record = await prisma.careerProfile.update({
      where: { id },
      data: { visibility, lastActiveAt: new Date() },
    });
    return toDTO(record);
  },

  /**
   * 检查 User 是否已有档案
   */
  async existsByUserId(userId: string): Promise<boolean> {
    const count = await prisma.careerProfile.count({
      where: { userId },
    });
    return count > 0;
  },

  /**
   * 删除档案（级联删除所有子数据）
   * 仅用于测试清理，不提供 API 接口
   */
  async delete(id: string) {
    await prisma.skillEvidence.deleteMany({ where: { candidateSkill: { profileId: id } } });
    await prisma.candidateSkill.deleteMany({ where: { profileId: id } });
    await prisma.candidateResume.deleteMany({ where: { profileId: id } });
    await prisma.candidateCard.deleteMany({ where: { profileId: id } });
    await prisma.careerTimelineEvent.deleteMany({ where: { profileId: id } });
    await prisma.workExperience.deleteMany({ where: { profileId: id } });
    await prisma.education.deleteMany({ where: { profileId: id } });
    await prisma.careerProfile.delete({ where: { id } });
  },
};
