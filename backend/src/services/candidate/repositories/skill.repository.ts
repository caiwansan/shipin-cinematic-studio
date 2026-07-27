// ============================================================
// SkillRepository — 技能图谱（三层：Skill → CandidateSkill → SkillEvidence）
// 职责：管理技能词表、人才技能关联、技能证据链
// 设计原则：DP-P3-03 可成长但证据不可篡改
// ============================================================

import { prisma } from '../../../utils/index.js';

// ── Skill（标准化词表）──

export interface CreateSkillInput {
  name: string;
  category?: string;
  aliases?: string[];
}

function skillToDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    category: record.category ?? null,
    aliases: record.aliases ?? [],
    createdAt: record.createdAt?.toISOString() ?? null,
  };
}

// ── CandidateSkill（人才技能关联）──

export interface AttachSkillInput {
  profileId: string;
  skillId: string;
  level?: string;
  confidence?: number;
  source?: string;
}

export interface UpdateCandidateSkillInput {
  level?: string;
  confidence?: number;
}

function candidateSkillToDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    skillId: record.skillId,
    level: record.level,
    confidence: record.confidence,
    source: record.source,
    lastAssessedAt: record.lastAssessedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

// ── SkillEvidence（证据链）──

export interface AddEvidenceInput {
  candidateSkillId: string;
  evidenceType: string;
  refId?: string;
  description?: string;
  metadata?: any;
}

function evidenceToDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    candidateSkillId: record.candidateSkillId,
    evidenceType: record.evidenceType,
    refId: record.refId ?? null,
    description: record.description ?? null,
    metadata: record.metadata ?? null,
    createdAt: record.createdAt?.toISOString() ?? null,
  };
}

export const skillRepository = {
  // ═══════════════════════════════════════════════════════════
  // Skill（词表）
  // ═══════════════════════════════════════════════════════════

  /**
   * 查找或创建技能（按名称，不区分大小写）
   */
  async findOrCreate(input: CreateSkillInput) {
    const existing = await prisma.skill.findUnique({
      where: { name: input.name },
    });
    if (existing) return skillToDTO(existing);

    const record = await prisma.skill.create({
      data: {
        name: input.name,
        category: input.category ?? null,
        aliases: input.aliases ?? [],
      },
    });
    return skillToDTO(record);
  },

  /**
   * 通过名称查找技能
   */
  async findByName(name: string) {
    const record = await prisma.skill.findUnique({
      where: { name },
    });
    return skillToDTO(record);
  },

  /**
   * 通过分类搜索技能
   */
  async listByCategory(category: string) {
    const records = await prisma.skill.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });
    return records.map(skillToDTO);
  },

  // ═══════════════════════════════════════════════════════════
  // CandidateSkill（人才技能关联）
  // ═══════════════════════════════════════════════════════════

  /**
   * 为人才附加技能
   * 同一技能不重复附加（profileId + skillId 唯一约束）
   */
  async attachSkill(input: AttachSkillInput) {
    const existing = await prisma.candidateSkill.findUnique({
      where: {
        profileId_skillId: {
          profileId: input.profileId,
          skillId: input.skillId,
        },
      },
    });
    if (existing) return candidateSkillToDTO(existing);

    const record = await prisma.candidateSkill.create({
      data: {
        profileId: input.profileId,
        skillId: input.skillId,
        level: input.level ?? 'beginner',
        confidence: input.confidence ?? 0,
        source: input.source ?? 'user',
      },
    });
    return candidateSkillToDTO(record);
  },

  /**
   * 获取人才的所有技能
   */
  async listByProfileId(profileId: string) {
    const records = await prisma.candidateSkill.findMany({
      where: { profileId },
      include: { skill: true },
      orderBy: { confidence: 'desc' },
    });
    return records.map((r: any) => ({
      ...candidateSkillToDTO(r),
      skillName: r.skill?.name ?? null,
      skillCategory: r.skill?.category ?? null,
    }));
  },

  /**
   * 获取单条人才技能
   */
  async getCandidateSkill(id: string) {
    const record = await prisma.candidateSkill.findUnique({
      where: { id },
      include: { skill: true },
    });
    if (!record) return null;
    return {
      ...candidateSkillToDTO(record),
      skillName: record.skill?.name ?? null,
      skillCategory: record.skill?.category ?? null,
    };
  },

  /**
   * 更新技能等级和置信度
   * 注意：source 记录是谁做的更新（user / ai / interview）
   */
  async updateCandidateSkill(id: string, input: UpdateCandidateSkillInput, source?: string) {
    const record = await prisma.candidateSkill.update({
      where: { id },
      data: {
        ...(input.level !== undefined && { level: input.level }),
        ...(input.confidence !== undefined && { confidence: input.confidence }),
        ...(source !== undefined && { source }),
        lastAssessedAt: new Date(),
      },
    });
    return candidateSkillToDTO(record);
  },

  /**
   * 移除技能关联
   */
  async detachSkill(profileId: string, skillId: string) {
    await prisma.candidateSkill.delete({
      where: {
        profileId_skillId: { profileId, skillId },
      },
    });
  },

  // ═══════════════════════════════════════════════════════════
  // SkillEvidence（证据链）
  // ═══════════════════════════════════════════════════════════

  /**
   * 添加证据
   */
  async addEvidence(input: AddEvidenceInput) {
    const record = await prisma.skillEvidence.create({
      data: {
        candidateSkillId: input.candidateSkillId,
        evidenceType: input.evidenceType,
        refId: input.refId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      },
    });
    return evidenceToDTO(record);
  },

  /**
   * 获取技能的所有证据
   */
  async listEvidence(candidateSkillId: string) {
    const records = await prisma.skillEvidence.findMany({
      where: { candidateSkillId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(evidenceToDTO);
  },

  /**
   * 获取证据详情
   */
  async getEvidence(id: string) {
    const record = await prisma.skillEvidence.findUnique({
      where: { id },
    });
    return evidenceToDTO(record);
  },
};
