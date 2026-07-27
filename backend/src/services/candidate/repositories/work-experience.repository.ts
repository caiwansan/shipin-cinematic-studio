// ============================================================
// WorkExperienceRepository — 工作经历（事实数据）
// 职责：管理 WorkExperience 的 CRUD
// 设计原则：DP-P3-06 AI 不可自动修改事实数据
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface CreateWorkExperienceInput {
  profileId: string;
  company: string;
  title: string;
  department?: string;
  employmentType?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent?: boolean;
  location?: string;
  description?: string;
  achievements?: string[];
  skillsUsed?: string[];
  source?: string;
}

export interface UpdateWorkExperienceInput {
  company?: string;
  title?: string;
  department?: string;
  employmentType?: string;
  startDate?: Date;
  endDate?: Date;
  isCurrent?: boolean;
  location?: string;
  description?: string;
  achievements?: string[];
  skillsUsed?: string[];
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    company: record.company,
    title: record.title,
    department: record.department ?? null,
    employmentType: record.employmentType ?? null,
    startDate: record.startDate?.toISOString() ?? null,
    endDate: record.endDate?.toISOString() ?? null,
    isCurrent: record.isCurrent,
    location: record.location ?? null,
    description: record.description ?? null,
    achievements: record.achievements ?? [],
    skillsUsed: record.skillsUsed ?? [],
    source: record.source,
    verified: record.verified,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const workExperienceRepository = {
  /**
   * 添加工作经历
   */
  async create(input: CreateWorkExperienceInput) {
    const record = await prisma.workExperience.create({
      data: {
        profileId: input.profileId,
        company: input.company,
        title: input.title,
        department: input.department ?? null,
        employmentType: input.employmentType ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        isCurrent: input.isCurrent ?? false,
        location: input.location ?? null,
        description: input.description ?? null,
        achievements: input.achievements ?? [],
        skillsUsed: input.skillsUsed ?? [],
        source: input.source ?? 'user',
      },
    });
    return toDTO(record);
  },

  /**
   * 获取档案下的所有工作经历
   */
  async listByProfileId(profileId: string) {
    const records = await prisma.workExperience.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    });
    return records.map(toDTO);
  },

  /**
   * 获取单条工作经历
   */
  async getById(id: string) {
    const record = await prisma.workExperience.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 更新工作经历
   */
  async update(id: string, input: UpdateWorkExperienceInput) {
    const record = await prisma.workExperience.update({
      where: { id },
      data: {
        ...(input.company !== undefined && { company: input.company }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.department !== undefined && { department: input.department }),
        ...(input.employmentType !== undefined && { employmentType: input.employmentType }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.isCurrent !== undefined && { isCurrent: input.isCurrent }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.achievements !== undefined && { achievements: input.achievements }),
        ...(input.skillsUsed !== undefined && { skillsUsed: input.skillsUsed }),
      },
    });
    return toDTO(record);
  },

  /**
   * 删除工作经历
   */
  async delete(id: string) {
    await prisma.workExperience.delete({ where: { id } });
  },

  /**
   * 标记为已验证
   */
  async markVerified(id: string) {
    const record = await prisma.workExperience.update({
      where: { id },
      data: { verified: true },
    });
    return toDTO(record);
  },
};
