// ============================================================
// CandidateCardRepository — 企业公开投影
// 职责：管理 CandidateCard 的读取和可见性控制
// 设计原则：DP-P3-02 默认最小公开
// 注意：Card 是 Projection，不存储完整职业事实
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface UpdateCardVisibilityInput {
  visibility: string;
  hiddenFields?: string[];
}

export interface UpdateCardPublicFieldsInput {
  headline?: string;
  summary?: string;
  skillTags?: string[];
  currentCity?: string;
  currentCompany?: string;
  currentTitle?: string;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    headline: record.headline ?? null,
    summary: record.summary ?? null,
    skillTags: record.skillTags ?? [],
    yearsExperience: record.yearsExperience,
    currentCity: record.currentCity ?? null,
    currentCompany: record.currentCompany ?? null,
    currentTitle: record.currentTitle ?? null,
    openToOpportunity: record.openToOpportunity,
    visibility: record.visibility,
    hiddenFields: record.hiddenFields ?? [],
    aiSummary: record.aiSummary ?? null,
    aiSummaryAt: record.aiSummaryAt?.toISOString() ?? null,
    viewCount: record.viewCount,
    lastViewedAt: record.lastViewedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const candidateCardRepository = {
  /**
   * 获取 Card（1:1 对应 Profile）
   */
  async getByProfileId(profileId: string) {
    const record = await prisma.candidateCard.findUnique({
      where: { profileId },
    });
    return toDTO(record);
  },

  /**
   * 创建 Card（通常在 Profile 创建时同步创建）
   */
  async create(profileId: string) {
    const record = await prisma.candidateCard.create({
      data: {
        profileId,
        visibility: 'private',
        skillTags: [],
        hiddenFields: [],
      },
    });
    return toDTO(record);
  },

  /**
   * 更新可见性
   */
  async updateVisibility(profileId: string, input: UpdateCardVisibilityInput) {
    const record = await prisma.candidateCard.update({
      where: { profileId },
      data: {
        visibility: input.visibility,
        ...(input.hiddenFields !== undefined && { hiddenFields: input.hiddenFields }),
      },
    });
    return toDTO(record);
  },

  /**
   * 更新公开字段
   * 注意：只能更新 Card 层面的展示字段，不能修改 Career Profile 事实
   */
  async updatePublicFields(profileId: string, input: UpdateCardPublicFieldsInput) {
    const record = await prisma.candidateCard.update({
      where: { profileId },
      data: {
        ...(input.headline !== undefined && { headline: input.headline }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.skillTags !== undefined && { skillTags: input.skillTags }),
        ...(input.currentCity !== undefined && { currentCity: input.currentCity }),
        ...(input.currentCompany !== undefined && { currentCompany: input.currentCompany }),
        ...(input.currentTitle !== undefined && { currentTitle: input.currentTitle }),
      },
    });
    return toDTO(record);
  },

  /**
   * 设置 AI 摘要
   */
  async setAiSummary(profileId: string, summary: string) {
    const record = await prisma.candidateCard.update({
      where: { profileId },
      data: {
        aiSummary: summary,
        aiSummaryAt: new Date(),
      },
    });
    return toDTO(record);
  },

  /**
   * 记录浏览
   */
  async recordView(profileId: string) {
    const record = await prisma.candidateCard.update({
      where: { profileId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
    return toDTO(record);
  },

  /**
   * 同步 openToOpportunity 信号（从 Career Profile 同步）
   */
  async syncOpenToOpportunity(profileId: string, openToOpportunity: boolean) {
    const record = await prisma.candidateCard.update({
      where: { profileId },
      data: { openToOpportunity },
    });
    return toDTO(record);
  },
};
