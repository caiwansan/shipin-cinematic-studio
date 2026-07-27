// ============================================================
// CandidateResumeRepository — 派生简历
// 职责：管理 CandidateResume 的生命周期
// 设计原则：DP-P3-01 Resume = Career Profile 的视图
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface CreateResumeInput {
  profileId: string;
  name: string;
  language?: string;
  targetRole?: string;
  contentJson: any;
  generatedBy?: string;
  sourceResumeId?: string;
  fileUrl?: string;
  fileFormat?: string;
  isDefault?: boolean;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    name: record.name,
    language: record.language,
    targetRole: record.targetRole ?? null,
    version: record.version,
    contentJson: record.contentJson,
    generatedBy: record.generatedBy,
    sourceResumeId: record.sourceResumeId ?? null,
    fileUrl: record.fileUrl ?? null,
    fileFormat: record.fileFormat ?? null,
    isDefault: record.isDefault,
    status: record.status,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const candidateResumeRepository = {
  /**
   * 创建简历
   * 如果该 profile 下没有活跃简历，自动设为 default
   */
  async create(input: CreateResumeInput) {
    // 自动检测：如果已有活跃简历，则 isDefault 取输入值或 false
    // 如果没有活跃简历，则自动设为 default
    if (input.isDefault === undefined) {
      const existing = await prisma.careerProfile.count({
        where: { id: input.profileId },
      });
      const activeCount = await prisma.candidateResume.count({
        where: { profileId: input.profileId, status: 'active' },
      });
      input.isDefault = activeCount === 0 && existing > 0;
    }

    const record = await prisma.candidateResume.create({
      data: {
        profileId: input.profileId,
        name: input.name,
        language: input.language ?? 'zh',
        targetRole: input.targetRole ?? null,
        contentJson: input.contentJson ?? {},
        generatedBy: input.generatedBy ?? 'user',
        sourceResumeId: input.sourceResumeId ?? null,
        fileUrl: input.fileUrl ?? null,
        fileFormat: input.fileFormat ?? null,
        isDefault: input.isDefault,
      },
    });
    return toDTO(record);
  },

  /**
   * 获取档案下的所有简历
   */
  async listByProfileId(profileId: string) {
    const records = await prisma.candidateResume.findMany({
      where: { profileId, status: 'active' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(toDTO);
  },

  /**
   * 获取单份简历
   */
  async getById(id: string) {
    const record = await prisma.candidateResume.findUnique({ where: { id } });
    return toDTO(record);
  },

  /**
   * 获取默认简历
   */
  async getDefaultByProfileId(profileId: string) {
    const record = await prisma.candidateResume.findFirst({
      where: { profileId, isDefault: true, status: 'active' },
    });
    return toDTO(record);
  },

  /**
   * 创建派生简历（AI 优化 / 岗位定制）
   */
  async createDerived(sourceResumeId: string, input: CreateResumeInput) {
    const record = await prisma.candidateResume.create({
      data: {
        profileId: input.profileId,
        name: input.name,
        language: input.language ?? 'zh',
        targetRole: input.targetRole ?? null,
        contentJson: input.contentJson ?? {},
        generatedBy: input.generatedBy ?? 'ai',
        sourceResumeId,
        isDefault: false,
      },
    });
    return toDTO(record);
  },

  /**
   * 设置默认简历
   * 先将该档案下所有简历 isDefault 设为 false，再设置目标为 true
   */
  async setDefault(id: string, profileId: string) {
    await prisma.$transaction([
      prisma.candidateResume.updateMany({
        where: { profileId },
        data: { isDefault: false },
      }),
      prisma.candidateResume.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
  },

  /**
   * 归档简历（软删除）
   */
  async archive(id: string) {
    const record = await prisma.candidateResume.update({
      where: { id },
      data: { status: 'archived' },
    });
    return toDTO(record);
  },

  /**
   * 获取派生链（某简历的所有衍生版本）
   */
  async getDerivedChain(sourceResumeId: string) {
    const records = await prisma.candidateResume.findMany({
      where: { sourceResumeId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDTO);
  },
};
