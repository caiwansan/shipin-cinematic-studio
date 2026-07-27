// ============================================================
// MatchEvidenceRepository — 匹配证据（Computed Evidence）
// 职责：管理 MatchEvidence 的 CRUD
// 数据性质：Computed，建立 Computed Data → Fact Data 的审计链
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface CreateEvidenceInput {
  matchResultId: string;
  evidenceType: string;
  claim: string;
  sourceType: string;
  sourceId: string;
  confidence: number;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    matchResultId: record.matchResultId,
    evidenceType: record.evidenceType,
    claim: record.claim,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    confidence: record.confidence,
    createdAt: record.createdAt?.toISOString() ?? null,
  };
}

export const matchEvidenceRepository = {
  /**
   * 创建证据
   */
  async create(input: CreateEvidenceInput) {
    const record = await prisma.matchEvidence.create({
      data: {
        matchResultId: input.matchResultId,
        evidenceType: input.evidenceType,
        claim: input.claim,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        confidence: input.confidence,
      },
    });
    return toDTO(record);
  },

  /**
   * 批量创建证据
   */
  async createMany(inputs: CreateEvidenceInput[]) {
    if (inputs.length === 0) return [];
    const records = await prisma.matchEvidence.createMany({
      data: inputs.map((input) => ({
        matchResultId: input.matchResultId,
        evidenceType: input.evidenceType,
        claim: input.claim,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        confidence: input.confidence,
      })),
    });
    return records;
  },

  /**
   * 获取某次匹配的所有证据
   */
  async listByMatchResult(matchResultId: string) {
    const records = await prisma.matchEvidence.findMany({
      where: { matchResultId },
      orderBy: { confidence: 'desc' },
    });
    return records.map(toDTO);
  },

  /**
   * 通过来源反查证据
   */
  async listBySource(sourceType: string, sourceId: string) {
    const records = await prisma.matchEvidence.findMany({
      where: { sourceType, sourceId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDTO);
  },

  /**
   * 删除某次匹配的所有证据
   */
  async deleteByMatchResult(matchResultId: string) {
    await prisma.matchEvidence.deleteMany({
      where: { matchResultId },
    });
  },
};
