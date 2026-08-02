/**
 * BrowserTrajectoryService — SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 08
 *
 * AI 操作轨迹（实时可见）
 * 记录 AI 正在做什么：打开页面 → 点击菜单 → 读取数据 → 生成报告
 * 老板实时查看：「Alice 现在正在运营我的抖音账号」
 *
 * 用法：
 *   const traj = new Trajectory(workspaceId, agentId, tenantId, orgId, sessionKey)
 *   await traj.step('open_page', '正在打开数据中心', url)
 *   await traj.done()
 */
import { prisma } from '../../utils/index.js'

export class BrowserTrajectoryService {
  /**
   * 记录一个动作步骤（自动递增 step）
   */
  async step(input: {
    tenantId: string
    organizationId?: string
    workspaceId: string
    agentId?: string
    sessionKey: string
    action: string
    description: string
    target?: string
    detail?: Record<string, unknown>
  }): Promise<void> {
    // 计算下一 step（同 session 最大 step + 1）
    const last = await prisma.browserTrajectory.findFirst({
      where: { workspaceId: input.workspaceId, sessionKey: input.sessionKey },
      orderBy: { step: 'desc' },
      select: { step: true },
    })
    await prisma.browserTrajectory.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId || null,
        workspaceId: input.workspaceId,
        agentId: input.agentId || null,
        sessionKey: input.sessionKey,
        step: (last?.step ?? 0) + 1,
        action: input.action,
        description: input.description,
        target: input.target || null,
        status: 'running',
        detail: (input.detail || {}) as any,
      },
    })
    console.log(`[Trajectory] ${input.agentId || 'agent'} ${input.description} (${input.action})`)
  }

  /** 标记某 session 的某步骤完成/失败 */
  async finish(workspaceId: string, sessionKey: string, step: number, status: 'done' | 'failed', detail?: Record<string, unknown>): Promise<void> {
    const traj = await prisma.browserTrajectory.findFirst({
      where: { workspaceId, sessionKey, step },
    })
    if (!traj) return
    await prisma.browserTrajectory.update({
      where: { id: traj.id },
      data: {
        status,
        ...(detail ? { detail: detail as any } : {}),
      },
    })
  }

  /** 查询 workspace 最近轨迹（实时面板） */
  async listByWorkspace(workspaceId: string, limit = 30): Promise<any[]> {
    return prisma.browserTrajectory.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /** 查询 agent 最近轨迹 */
  async listByAgent(agentId: string, limit = 30): Promise<any[]> {
    return prisma.browserTrajectory.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}

export const browserTrajectoryService = new BrowserTrajectoryService()
