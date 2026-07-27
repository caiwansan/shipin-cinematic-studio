// ============================================================
// CareerTimelineService — 职业成长事件流服务
// 职责：管理 CareerTimelineEvent 的追加、查询、Correction 链
// 设计原则：DP-P3-04 Append-only，不允许 Update / Delete
//
// 核心能力：
//   1. 事件追加（唯一写入方式）
//   2. Correction 链（追加新事件，不修改旧事件）
//   3. 时间线查询（按时间/类型筛选）
//   4. 自动事件生成（从 Work Experience / Education 追加）
// ============================================================

import { prisma } from '../../../utils/index.js';
import { careerTimelineRepository, AppendEventInput } from '../repositories/career-timeline.repository.js';

export interface TimelineEventDTO {
  id: string;
  profileId: string;
  eventType: string;
  title: string;
  description: string | null;
  organization: string | null;
  occurredAt: string | null;
  granularity: string;
  relatedEventId: string | null;
  relatedSkillNames: string[];
  metadata: Record<string, any> | null;
  source: string;
  createdAt: string | null;
}

export interface TimelineQueryOptions {
  profileId: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CorrectionInput {
  /** 被修正的原始事件 ID */
  originalEventId: string;
  /** 修正后的事件类型 */
  eventType: string;
  title: string;
  description?: string;
  organization?: string;
  occurredAt: Date;
  granularity?: string;
  relatedSkillNames?: string[];
  metadata?: Record<string, any>;
  source?: string;
}

/**
 * 从 Work Experience 自动生成 Timeline 事件
 */
async function generateEventsFromWorkExperience(
  profileId: string,
  workExp: any,
): Promise<AppendEventInput[]> {
  const events: AppendEventInput[] = [];

  if (workExp.startDate) {
    events.push({
      profileId,
      eventType: 'job_start',
      title: `加入 ${workExp.company || '未知公司'}`,
      description: workExp.title ? `担任 ${workExp.title}` : workExp.description,
      organization: workExp.company || null,
      occurredAt: new Date(workExp.startDate),
      granularity: 'day',
      source: 'auto',
      metadata: { workExperienceId: workExp.id },
    });
  }

  if (workExp.endDate) {
    events.push({
      profileId,
      eventType: 'job_end',
      title: `离开 ${workExp.company || '未知公司'}`,
      description: workExp.title ? `曾任 ${workExp.title}` : undefined,
      organization: workExp.company || null,
      occurredAt: new Date(workExp.endDate),
      granularity: 'day',
      source: 'auto',
      metadata: { workExperienceId: workExp.id },
    });
  }

  return events;
}

/**
 * 从 Education 自动生成 Timeline 事件
 */
async function generateEventsFromEducation(
  profileId: string,
  education: any,
): Promise<AppendEventInput[]> {
  const events: AppendEventInput[] = [];

  if (education.startDate) {
    events.push({
      profileId,
      eventType: 'education',
      title: `入读 ${education.school || '未知学校'}`,
      description: [education.degree, education.major].filter(Boolean).join(' · '),
      organization: education.school || null,
      occurredAt: new Date(education.startDate),
      granularity: 'day',
      source: 'auto',
      metadata: { educationId: education.id },
    });
  }

  if (education.endDate) {
    events.push({
      profileId,
      eventType: 'education',
      title: `毕业于 ${education.school || '未知学校'}`,
      description: [education.degree, education.major].filter(Boolean).join(' · '),
      organization: education.school || null,
      occurredAt: new Date(education.endDate),
      granularity: 'day',
      source: 'auto',
      metadata: { educationId: education.id },
    });
  }

  return events;
}

// ============================================================
// 公开接口
// ============================================================

export const careerTimelineService = {
  /**
   * 追加事件（唯一写入方式）
   */
  async appendEvent(input: AppendEventInput): Promise<TimelineEventDTO> {
    return careerTimelineRepository.appendEvent(input) as unknown as TimelineEventDTO;
  },

  /**
   * 追加 Correction 事件（不修改原始事件）
   * 通过 relatedEventId 链接到原始事件
   */
  async appendCorrection(profileId: string, input: CorrectionInput): Promise<TimelineEventDTO> {
    return careerTimelineRepository.appendEvent({
      profileId,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? null,
      organization: input.organization ?? null,
      occurredAt: input.occurredAt,
      granularity: input.granularity ?? 'day',
      relatedEventId: input.originalEventId,
      relatedSkillNames: input.relatedSkillNames ?? [],
      metadata: input.metadata ?? null,
      source: input.source ?? 'user_correction',
    }) as unknown as TimelineEventDTO;
  },

  /**
   * 查询时间线
   */
  async queryTimeline(options: TimelineQueryOptions): Promise<{
    events: TimelineEventDTO[];
    total: number;
  }> {
    const { profileId, eventType, limit = 50, offset = 0 } = options;

    // 构建 where 条件
    const where: Record<string, any> = { profileId };
    if (eventType) {
      where.eventType = eventType;
    }
    if (options.startDate || options.endDate) {
      where.occurredAt = {};
      if (options.startDate) where.occurredAt.gte = options.startDate;
      if (options.endDate) where.occurredAt.lte = options.endDate;
    }

    const [records, total] = await Promise.all([
      prisma.careerTimelineEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.careerTimelineEvent.count({ where }),
    ]);

    const events: TimelineEventDTO[] = records.map((r: any) => ({
      id: r.id as string,
      profileId: r.profileId as string,
      eventType: r.eventType as string,
      title: r.title as string,
      description: (r.description ?? null) as string | null,
      organization: (r.organization ?? null) as string | null,
      occurredAt: (r.occurredAt?.toISOString() ?? null) as string | null,
      granularity: r.granularity as string,
      relatedEventId: (r.relatedEventId ?? null) as string | null,
      relatedSkillNames: (r.relatedSkillNames ?? []) as string[],
      metadata: (r.metadata ?? null) as Record<string, any> | null,
      source: r.source as string,
      createdAt: (r.createdAt?.toISOString() ?? null) as string | null,
    }));

    return { events, total };
  },

  /**
   * 获取单条事件详情
   */
  async getEvent(eventId: string): Promise<TimelineEventDTO | null> {
    const record = await careerTimelineRepository.getById(eventId);
    if (!record) return null;
    return record as unknown as TimelineEventDTO;
  },

  /**
   * 获取 Correction 链
   */
  async getCorrections(eventId: string): Promise<TimelineEventDTO[]> {
    return careerTimelineRepository.getCorrections(eventId) as unknown as TimelineEventDTO[];
  },

  /**
   * 获取事件及其 Correction 链
   */
  async getEventWithCorrections(eventId: string): Promise<{
    event: TimelineEventDTO | null;
    corrections: TimelineEventDTO[];
  }> {
    const [event, corrections] = await Promise.all([
      careerTimelineRepository.getById(eventId),
      careerTimelineRepository.getCorrections(eventId),
    ]);

    return {
      event: event as unknown as TimelineEventDTO | null,
      corrections: corrections as unknown as TimelineEventDTO[],
    };
  },

  /**
   * 从 Work Experience 自动同步事件
   * 当用户新增/编辑工作经历时调用
   */
  async syncFromWorkExperience(profileId: string, workExpId: string): Promise<TimelineEventDTO[]> {
    const workExp = await prisma.workExperience.findUnique({
      where: { id: workExpId },
    });

    if (!workExp) return [];

    const inputs = await generateEventsFromWorkExperience(profileId, workExp);
    const results: TimelineEventDTO[] = [];

    for (const input of inputs) {
      const event = await careerTimelineRepository.appendEvent(input);
      results.push(event as unknown as TimelineEventDTO);
    }

    return results;
  },

  /**
   * 从 Education 自动同步事件
   * 当用户新增/编辑教育经历时调用
   */
  async syncFromEducation(profileId: string, educationId: string): Promise<TimelineEventDTO[]> {
    const education = await prisma.education.findUnique({
      where: { id: educationId },
    });

    if (!education) return [];

    const inputs = await generateEventsFromEducation(profileId, education);
    const results: TimelineEventDTO[] = [];

    for (const input of inputs) {
      const event = await careerTimelineRepository.appendEvent(input);
      results.push(event as unknown as TimelineEventDTO);
    }

    return results;
  },

  /**
   * 获取完整时间线（含 Correction 标记）
   * 用于前端展示：标记哪些事件已被修正
   */
  async getFullTimeline(profileId: string): Promise<{
    events: Array<TimelineEventDTO & { hasCorrections: boolean; correctionCount: number }>;
    total: number;
  }> {
    const { events, total } = await this.queryTimeline({ profileId, limit: 100 });

    // 查询每个事件是否有 correction
    const eventsWithCorrections = await Promise.all(
      events.map(async (event) => {
        const corrections = await careerTimelineRepository.getCorrections(event.id);
        return {
          ...event,
          hasCorrections: corrections.length > 0,
          correctionCount: corrections.length,
        };
      }),
    );

    return { events: eventsWithCorrections, total };
  },

  /**
   * 按类型统计事件数量
   */
  async getEventStats(profileId: string): Promise<Record<string, number>> {
    const events = await prisma.careerTimelineEvent.findMany({
      where: { profileId },
      select: { eventType: true },
    });

    const stats: Record<string, number> = {};
    for (const e of events) {
      stats[e.eventType] = (stats[e.eventType] || 0) + 1;
    }

    return stats;
  },
};
