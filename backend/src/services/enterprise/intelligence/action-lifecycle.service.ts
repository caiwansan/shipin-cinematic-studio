/**
 * Action Lifecycle Service — Sprint 4.2.3
 * 职责: Action CRUD + Decision → Action 转换
 * 禁止: 状态流转（由 action-approval / action-audit 负责）
 * CTO: status != APPROVED 禁止 EXECUTING（Service enforce）
 */
import { prisma } from '../../../utils/index.js';
import { tenantOnly } from '../../../enterprise/reality/demo-boundary.js';
import { randomUUID } from 'crypto';
import {
  ActionStatus,
  OwnerType,
  CreateActionInput,
  StatusHistoryEntry,
  ActionNotFoundError,
  ListActionsOptions,
} from './action.types.js';

export class ActionLifecycleService {
  /**
   * Decision → Action 转换
   * 一个 Decision 可以产生多个 Action (CTO Contract 1)
   */
  async createActionsFromDecision(
    tenantId: string,
    decisionId: string,
    actions: CreateActionInput[]
  ): Promise<any[]> {
    // CTO: decision_id 必须 NOT NULL，验证 Decision 存在
    const decision = await prisma.enterpriseRecommendation.findFirst({
      where: { id: decisionId, ...tenantOnly(tenantId) },
    });
    if (!decision) {
      throw new ActionNotFoundError(decisionId);
    }

    const created: any[] = [];
    for (const input of actions) {
      const id = randomUUID();
      const now = new Date();
      const historyEntry: StatusHistoryEntry = {
        from: 'init',
        to: ActionStatus.PENDING,
        actor: 'system',
        note: `Created from decision ${decisionId}`,
        time: now.toISOString(),
      };

      const action = await prisma.enterpriseAction.create({
        data: {
          id,
          tenantId,
          decisionId,
          title: input.title,
          description: input.description || null,
          status: ActionStatus.PENDING,
          priority: input.priority || 'P3',
          ownerType: input.ownerType || OwnerType.HUMAN,
          ownerId: input.ownerId,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          statusHistory: [historyEntry] as any,
        },
      });
      created.push(action);
    }

    // 更新 Decision 状态为 ACCEPTED
    await prisma.enterpriseRecommendation.update({
      where: { id: decisionId },
      data: { decisionStatus: 'accepted' },
    });

    return created;
  }

  /**
   * 获取 Action 详情
   */
  async getActionById(tenantId: string, actionId: string): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
      include: { decision: { select: { id: true, title: true, priorityLevel: true } } },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }
    return action;
  }

  /**
   * Action 列表（分页 + 筛选）
   */
  async listActions(tenantId: string, options?: ListActionsOptions): Promise<{ items: any[]; total: number }> {
    const where: any = tenantOnly(tenantId);
    if (options?.status) where.status = options.status;
    if (options?.ownerType) where.ownerType = options.ownerType;
    if (options?.ownerId) where.ownerId = options.ownerId;
    if (options?.decisionId) where.decisionId = options.decisionId;

    const [items, total] = await Promise.all([
      prisma.enterpriseAction.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: options?.limit || 20,
        skip: options?.offset || 0,
        include: { decision: { select: { id: true, title: true } } },
      }),
      prisma.enterpriseAction.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 更新 Action 字段（仅 owner / dueDate / description）
   */
  async updateAction(
    tenantId: string,
    actionId: string,
    data: Partial<Pick<CreateActionInput, 'ownerType' | 'ownerId' | 'dueDate' | 'description' | 'priority'>>
  ): Promise<any> {
    const existing = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!existing) {
      throw new ActionNotFoundError(actionId);
    }

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        ...(data.ownerType && { ownerType: data.ownerType }),
        ...(data.ownerId && { ownerId: data.ownerId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority && { priority: data.priority }),
        ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
        updatedAt: new Date(),
      },
    });
  }
}

export const actionLifecycleService = new ActionLifecycleService();
