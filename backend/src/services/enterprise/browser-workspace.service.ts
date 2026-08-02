/**
 * BrowserWorkspaceService — SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 01/02
 *
 * Browser Workspace SSOT（AI 员工数字办公环境）
 * ── 核心认知：账号身份 ≠ 运行环境 ──
 *   EnterpriseChannelAccount = 身份（是谁）：凭证/状态/归属
 *   BrowserWorkspace        = 工作环境（在哪里工作）：浏览器 profile/生命周期/健康
 *
 * 职责：
 * - 创建/查询/更新 BrowserWorkspace 记录（SSOT，唯一事实源）
 * - workspace 状态机：CREATED → READY → RUNNING → ERROR / DESTROYED
 * - profilePath 计算（organizationId/channelAccountId 分层目录）
 * - 生命周期操作（start/stop/restart/healthCheck/destroy）委托 BrowserRuntimeService 执行
 *
 * 边界（掌柜批准约束）：
 * - 不存储凭证/cookie（唯一凭证源仍是 EnterpriseChannelAccount.credentialEncrypted）
 * - 不包含 AI 员工逻辑 / 操作日志（ChannelOperationLog 属 Task 07）
 * - 不删除现有 ChannelBrowserSession / BrowserRuntimeService（增量升级）
 */
import { prisma } from '../../utils/index.js'
import path from 'path'

export type WorkspaceStatus = 'CREATED' | 'READY' | 'RUNNING' | 'ERROR' | 'DESTROYED'

export interface BrowserWorkspaceRecord {
  id: string
  tenantId: string
  organizationId: string
  channelAccountId: string
  workspaceType: string
  profilePath: string
  status: WorkspaceStatus
  browserVersion: string | null
  lastStartedAt: Date | null
  lastHealthCheckAt: Date | null
  lastError: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

/** 工作空间根目录（env 可覆盖） */
const WORKSPACE_ROOT = process.env.BROWSER_WORKSPACE_ROOT || '/data/browser-workspaces'

export class BrowserWorkspaceService {
  /**
   * 计算 workspace 的持久化 profile 路径
   * 目录结构：<ROOT>/<organizationId>/<channelAccountId>/profile
   * 每企业每账号独立、永久、可备份
   */
  getProfilePath(organizationId: string, channelAccountId: string): string {
    const org = String(organizationId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
    const acc = String(channelAccountId || 'new').replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(WORKSPACE_ROOT, org, acc, 'profile')
  }

  /**
   * 获取或创建 workspace（by channelAccountId）
   * - 已存在：返回现有记录（幂等）
   * - 不存在：创建（CREATED 状态，profilePath 按企业/账号分层）
   */
  async getOrCreate(tenantId: string, organizationId: string, channelAccountId: string): Promise<BrowserWorkspaceRecord> {
    const existing = await prisma.browserWorkspace.findUnique({
      where: { channelAccountId },
    })
    if (existing) return this.map(existing)

    const profilePath = this.getProfilePath(organizationId, channelAccountId)
    const created = await prisma.browserWorkspace.create({
      data: {
        tenantId,
        organizationId,
        channelAccountId,
        workspaceType: 'chrome',
        profilePath,
        status: 'CREATED',
        metadata: {},
      },
    })
    console.log(`[BrowserWorkspace] created org=${organizationId} account=${channelAccountId} profile=${profilePath}`)
    return this.map(created)
  }

  /** 按 id 查询 */
  async findById(id: string): Promise<BrowserWorkspaceRecord | null> {
    const found = await prisma.browserWorkspace.findUnique({ where: { id } })
    return found ? this.map(found) : null
  }

  /** 按 channelAccountId 查询 */
  async findByChannelAccount(channelAccountId: string): Promise<BrowserWorkspaceRecord | null> {
    const found = await prisma.browserWorkspace.findUnique({ where: { channelAccountId } })
    return found ? this.map(found) : null
  }

  /** 按组织查询（多企业隔离） */
  async listByOrganization(organizationId: string): Promise<BrowserWorkspaceRecord[]> {
    const rows = await prisma.browserWorkspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(r => this.map(r))
  }

  /** 状态机流转（带校验） */
  async transition(id: string, from: WorkspaceStatus[], to: WorkspaceStatus): Promise<BrowserWorkspaceRecord> {
    const ws = await this.findById(id)
    if (!ws) throw new Error(`BrowserWorkspace not found: ${id}`)
    if (!from.includes(ws.status)) {
      throw new Error(`BrowserWorkspace 状态流转非法: ${ws.status} → ${to}（允许: ${from.join('/')}）`)
    }
    const data: any = { status: to }
    if (to === 'RUNNING') data.lastStartedAt = new Date()
    if (to === 'ERROR') data.lastError = null
    if (to === 'DESTROYED') data.lastError = 'workspace destroyed'
    const updated = await prisma.browserWorkspace.update({ where: { id }, data })
    console.log(`[BrowserWorkspace] ${ws.channelAccountId} status: ${ws.status} → ${to}`)
    return this.map(updated)
  }

  /** 标记健康检查通过 */
  async markHealthCheck(id: string, browserVersion?: string): Promise<BrowserWorkspaceRecord> {
    const updated = await prisma.browserWorkspace.update({
      where: { id },
      data: {
        lastHealthCheckAt: new Date(),
        ...(browserVersion ? { browserVersion } : {}),
      },
    })
    return this.map(updated)
  }

  /** 标记错误 */
  async markError(id: string, error: string): Promise<void> {
    await prisma.browserWorkspace.update({
      where: { id },
      data: { status: 'ERROR', lastError: String(error).slice(0, 1000) },
    })
  }

  /** 更新 metadata（如 verification 信息） */
  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<BrowserWorkspaceRecord> {
    const ws = await this.findById(id)
    if (!ws) throw new Error(`BrowserWorkspace not found: ${id}`)
    const updated = await prisma.browserWorkspace.update({
      where: { id },
      data: { metadata: { ...(ws.metadata || {}), ...metadata } as any },
    })
    return this.map(updated)
  }

  private map(row: any): BrowserWorkspaceRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      channelAccountId: row.channelAccountId,
      workspaceType: row.workspaceType,
      profilePath: row.profilePath,
      status: row.status,
      browserVersion: row.browserVersion,
      lastStartedAt: row.lastStartedAt,
      lastHealthCheckAt: row.lastHealthCheckAt,
      lastError: row.lastError,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const browserWorkspaceService = new BrowserWorkspaceService()
