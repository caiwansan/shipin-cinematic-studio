// ============================================================
// JobRequirementRepository — 岗位要求（Derived Data）
// 职责：管理 JobRequirementProfile 的 CRUD
// 数据性质：Derived from JD，非事实数据
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface CreateJobRequirementInput {
  enterpriseId: string;
  jobTitle: string;
  jobDescription?: string | null;
  requiredSkills: Array<{ skillId: string; skillName: string; minLevel?: string }>;
  preferredSkills?: Array<{ skillId: string; skillName: string }>;
  experienceMin?: number;
  experienceMax?: number | null;
  educationMin?: string | null;
  preferredMajors?: string[];
  industries?: string[];
  employmentType?: string | null;
  location?: string | null;
  remoteOption?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  weights?: Record<string, number> | null;
}

export interface UpdateJobRequirementInput {
  jobTitle?: string;
  jobDescription?: string;
  requiredSkills?: Array<{ skillId: string; skillName: string; minLevel?: string }>;
  preferredSkills?: Array<{ skillId: string; skillName: string }>;
  experienceMin?: number;
  experienceMax?: number;
  educationMin?: string;
  preferredMajors?: string[];
  industries?: string[];
  employmentType?: string;
  location?: string;
  remoteOption?: string;
  salaryMin?: number;
  salaryMax?: number;
  weights?: Record<string, number>;
  status?: string;
}

export interface JobRequirementDTO {
  id: string;
  enterpriseId: string;
  jobTitle: string;
  jobDescription: string | null;
  requiredSkills: any;
  preferredSkills: any;
  experienceMin: number;
  experienceMax: number | null;
  educationMin: string | null;
  preferredMajors: string[];
  industries: string[];
  employmentType: string | null;
  location: string | null;
  remoteOption: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  weights: any;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

function toDTO(record: any): JobRequirementDTO | null {
  if (!record) return null;
  return {
    id: record.id,
    enterpriseId: record.enterpriseId,
    jobTitle: record.jobTitle,
    jobDescription: record.jobDescription ?? null,
    requiredSkills: record.requiredSkills,
    preferredSkills: record.preferredSkills ?? [],
    experienceMin: record.experienceMin,
    experienceMax: record.experienceMax ?? null,
    educationMin: record.educationMin ?? null,
    preferredMajors: record.preferredMajors ?? [],
    industries: record.industries ?? [],
    employmentType: record.employmentType ?? null,
    location: record.location ?? null,
    remoteOption: record.remoteOption ?? null,
    salaryMin: record.salaryMin ?? null,
    salaryMax: record.salaryMax ?? null,
    weights: record.weights ?? null,
    status: record.status,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const jobRequirementRepository = {
  /**
   * 创建岗位要求
   */
  async create(input: CreateJobRequirementInput): Promise<JobRequirementDTO> {
    const record = await prisma.jobRequirementProfile.create({
      data: {
        enterpriseId: input.enterpriseId,
        jobTitle: input.jobTitle,
        jobDescription: input.jobDescription ?? null,
        requiredSkills: input.requiredSkills as any,
        preferredSkills: (input.preferredSkills ?? []) as any,
        experienceMin: input.experienceMin ?? 0,
        experienceMax: input.experienceMax ?? null,
        educationMin: input.educationMin ?? null,
        preferredMajors: input.preferredMajors ?? [],
        industries: input.industries ?? [],
        employmentType: input.employmentType ?? null,
        location: input.location ?? null,
        remoteOption: input.remoteOption ?? null,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
        weights: (input.weights ?? null) as any,
      },
    });
    const dto = toDTO(record);
    if (!dto) throw new Error('Failed to create JobRequirementProfile');
    return dto;
  },

  /**
   * 通过 ID 获取岗位要求
   */
  async getById(id: string) {
    const record = await prisma.jobRequirementProfile.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 获取企业所有岗位要求
   */
  async listByEnterprise(enterpriseId: string, status?: string) {
    const records = await prisma.jobRequirementProfile.findMany({
      where: {
        enterpriseId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDTO);
  },

  /**
   * 更新岗位要求
   */
  async update(id: string, input: UpdateJobRequirementInput) {
    const record = await prisma.jobRequirementProfile.update({
      where: { id },
      data: {
        ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle }),
        ...(input.jobDescription !== undefined && { jobDescription: input.jobDescription }),
        ...(input.requiredSkills !== undefined && { requiredSkills: input.requiredSkills as any }),
        ...(input.preferredSkills !== undefined && { preferredSkills: input.preferredSkills as any }),
        ...(input.experienceMin !== undefined && { experienceMin: input.experienceMin }),
        ...(input.experienceMax !== undefined && { experienceMax: input.experienceMax }),
        ...(input.educationMin !== undefined && { educationMin: input.educationMin }),
        ...(input.preferredMajors !== undefined && { preferredMajors: input.preferredMajors }),
        ...(input.industries !== undefined && { industries: input.industries }),
        ...(input.employmentType !== undefined && { employmentType: input.employmentType }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.remoteOption !== undefined && { remoteOption: input.remoteOption }),
        ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
        ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
        ...(input.weights !== undefined && { weights: input.weights as any }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      },
    });
    return toDTO(record);
  },

  /**
   * 删除岗位要求（级联删除匹配结果和证据）
   */
  async delete(id: string) {
    await prisma.jobRequirementProfile.delete({ where: { id } });
  },
};
