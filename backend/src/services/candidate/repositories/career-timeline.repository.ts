// ============================================================
// CareerTimelineRepository — 职业成长事件流
// 职责：管理 CareerTimelineEvent 的追加和查询
// 设计原则：DP-P3-04 Append-only，不允许 Update / Delete
// Correction 通过追加 Correction Event 实现（relatedEventId）
// ============================================================

import { prisma } from '../../../utils/index.js';

export interface AppendEventInput {
  profileId: string;
  eventType: string;
  title: string;
  description?: string | null;
  organization?: string | null;
  occurredAt: Date;
  granularity?: string;
  relatedEventId?: string;
  relatedSkillNames?: string[];
  metadata?: any;
  source?: string;
}

function toDTO(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    profileId: record.profileId,
    eventType: record.eventType,
    title: record.title,
    description: record.description ?? null,
    organization: record.organization ?? null,
    occurredAt: record.occurredAt?.toISOString() ?? null,
    granularity: record.granularity,
    relatedEventId: record.relatedEventId ?? null,
    relatedSkillNames: record.relatedSkillNames ?? [],
    metadata: record.metadata ?? null,
    source: record.source,
    createdAt: record.createdAt?.toISOString() ?? null,
  };
}

export const careerTimelineRepository = {
  /**
   * 追加事件（唯一写入方式）
   * 不允许修改已有事件
   */
  async appendEvent(input: AppendEventInput) {
    const record = await prisma.careerTimelineEvent.create({
      data: {
        profileId: input.profileId,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        organization: input.organization ?? null,
        occurredAt: input.occurredAt,
        granularity: input.granularity ?? 'day',
        relatedEventId: input.relatedEventId ?? null,
        relatedSkillNames: input.relatedSkillNames ?? [],
        metadata: input.metadata ?? null,
        source: input.source ?? 'user',
      },
    });
    return toDTO(record);
  },

  /**
   * 获取档案下的所有事件（按时间排序）
   */
  async listByProfileId(profileId: string, options?: { limit?: number; offset?: number }) {
    const records = await prisma.careerTimelineEvent.findMany({
      where: { profileId },
      orderBy: { occurredAt: 'desc' },
      ...(options?.limit !== undefined && { take: options.limit }),
      ...(options?.offset !== undefined && { skip: options.offset }),
    });
    return records.map(toDTO);
  },

  /**
   * 获取单条事件
   */
  async getById(id: string) {
    const record = await prisma.careerTimelineEvent.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 获取某事件的 Correction 链
   */
  async getCorrections(eventId: string) {
    const records = await prisma.careerTimelineEvent.findMany({
      where: { relatedEventId: eventId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toDTO);
  },

  /**
   * 按事件类型筛选
   */
  async listByEventType(profileId: string, eventType: string) {
    const records = await prisma.careerTimelineEvent.findMany({
      where: { profileId, eventType },
      orderBy: { occurredAt: 'desc' },
    });
    return records.map(toDTO);
  },

  /**
   * 统计事件数量
   */
  async countByProfileId(profileId: string): Promise<number> {
    return prisma.careerTimelineEvent.count({
      where: { profileId },
    });
  },
};
