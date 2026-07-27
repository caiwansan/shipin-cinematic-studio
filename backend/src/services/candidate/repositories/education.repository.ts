// ============================================================
// EducationRepository — 教育经历（事实数据）
// 职责：管理 Education 的 CRUD
// 设计原则：DP-P3-06 AI 不可自动修改事实数据
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface CreateEducationInput {
  profileId: string;
  school: string;
  degree?: string;
  major?: string;
  startDate?: Date;
  endDate?: Date;
  gpa?: number;
  description?: string;
}

export interface UpdateEducationInput {
  school?: string;
  degree?: string;
  major?: string;
  startDate?: Date;
  endDate?: Date;
  gpa?: number;
  description?: string;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    school: record.school,
    degree: record.degree ?? null,
    major: record.major ?? null,
    startDate: record.startDate?.toISOString() ?? null,
    endDate: record.endDate?.toISOString() ?? null,
    gpa: record.gpa ?? null,
    description: record.description ?? null,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const educationRepository = {
  async create(input: CreateEducationInput) {
    const record = await prisma.education.create({
      data: {
        profileId: input.profileId,
        school: input.school,
        degree: input.degree ?? null,
        major: input.major ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        gpa: input.gpa ?? null,
        description: input.description ?? null,
      },
    });
    return toDTO(record);
  },

  async listByProfileId(profileId: string) {
    const records = await prisma.education.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    });
    return records.map(toDTO);
  },

  async getById(id: string) {
    const record = await prisma.education.findUnique({ where: { id } });
    return toDTO(record);
  },

  async update(id: string, input: UpdateEducationInput) {
    const record = await prisma.education.update({
      where: { id },
      data: {
        ...(input.school !== undefined && { school: input.school }),
        ...(input.degree !== undefined && { degree: input.degree }),
        ...(input.major !== undefined && { major: input.major }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.gpa !== undefined && { gpa: input.gpa }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    return toDTO(record);
  },

  async delete(id: string) {
    await prisma.education.delete({ where: { id } });
  },
};
