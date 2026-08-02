/**
 * ChannelOperationLogService — SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 07
 *
 * AI 员工渠道操作日志（防重复操作）
 * - 每次渠道操作写一条日志（读取/发布/回复/评论）
 * - 唯一约束 (workspaceId, action, target)：同工作空间对同一目标同一动作只允许一次
 * - 重复操作插入被拦截 → 返回 duplicate 结果（上层转「已执行过」提示）
 *
 * 用途：
 * - 防止重复发布 / 重复评论 / 重复操作
 * - 操作可审计（老板查看 Alice 在抖音做了什么）
 */
import { prisma } from '../../utils/index.js'

export interface OperationLogInput {
  tenantId: string
  organizationId?: string
  workspaceId: string
  channelAccountId: string
  agentId?: string
  action: string
  target: string
  detail?: Record<string, unknown>
  screenshot?: string
}

export class ChannelOperationLogService {
  /**
   * 记录操作开始（幂等创建；若已存在同键日志 → 返回 null 表示重复）
   */
  async begin(input: OperationLogInput): Promise<{ id: string; duplicate: boolean }> {
    try {
      const created = await prisma.channelOperationLog.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId || null,
          workspaceId: input.workspaceId,
          channelAccountId: input.channelAccountId,
          agentId: input.agentId || null,
          action: input.action,
          target: input.target,
          result: 'pending',
          detail: (input.detail || {}) as any,
          screenshot: input.screenshot || null,
        },
      })
      return { id: created.id, duplicate: false }
    } catch (e: any) {
      // P2002 = 唯一约束冲突（重复操作）
      if (String(e.code) === 'P2002') {
        const existing = await prisma.channelOperationLog.findUnique({
          where: {
            workspaceId_action_target: {
              workspaceId: input.workspaceId,
              action: input.action,
              target: input.target,
            },
          },
        })
        return { id: existing?.id || '', duplicate: true }
      }
      throw e
    }
  }

  /** 完成（成功/失败） */
  async finish(id: string, result: 'success' | 'failed' | 'duplicate', detail?: Record<string, unknown>): Promise<void> {
    await prisma.channelOperationLog.update({
      where: { id },
      data: {
        result,
        finishedAt: new Date(),
        ...(detail ? { detail: detail as any } : {}),
      },
    })
  }

  /** 查询工作空间的最近操作（AI 轨迹审计） */
  async listByWorkspace(workspaceId: string, limit = 50): Promise<any[]> {
    return prisma.channelOperationLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /** 查询组织的最近操作 */
  async listByOrganization(organizationId: string, limit = 100): Promise<any[]> {
    return prisma.channelOperationLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /** 查询是否已执行过（防重复） */
  async hasExecuted(workspaceId: string, action: string, target: string): Promise<boolean> {
    const found = await prisma.channelOperationLog.findUnique({
      where: {
        workspaceId_action_target: { workspaceId, action, target },
      },
      select: { result: true },
    })
    return !!found && found.result === 'success'
  }
}

export const channelOperationLogService = new ChannelOperationLogService()
