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
  // SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 — 业务域（career/media/ecommerce/legal）
  businessType: string
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

/** 工作空间根目录（env 可覆盖）——兼容存量目录，新路径统一走 browserRuntime 同源（见下） */
const WORKSPACE_ROOT = process.env.BROWSER_WORKSPACE_ROOT || '/data/browser-workspaces'

export class BrowserWorkspaceService {
  /**
   * SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 0 — Profile 路径统一（根因修复）
   *
   * ⚠️ 双轨 profile 是「电脑登录了但系统不知道」的物理根因：
   *   登录链路（adapter）把登录态写入 /data/browser-profiles/<platform>/<accountId>，
   *   而 workspace 启动的浏览器用 /data/browser-workspaces/<org>/<accountId>/profile（空电脑）
   *   → 刷新/重启后 workspace 的浏览器与登录浏览器不是同一个 → 登录态不共享。
   *
   * 修复：workspace 的 profile 与 adapter 登录 profile 指向同一目录
   *   （唯一事实源：BrowserRuntimeService.getProfilePath = /data/browser-profiles/<platform>/<accountId>）
   * 掌柜原则：不改变 BrowserWorkspace 架构（记录/状态机/生命周期不变），只统一存储位置。
   */
  getProfilePath(platform: string, channelAccountId: string): string {
    return path.join(WORKSPACE_ROOT.replace(/browser-workspaces$/, 'browser-profiles'), platform, String(channelAccountId || 'new').replace(/[^a-zA-Z0-9_-]/g, '_'))
  }

  /**
   * SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 0 — 会话 ID 统一
   * 浏览器实例 Map 按 sessionId 键控；登录链路（adapter）用 `${platform}:${accountId}`。
   * workspace 生命周期操作必须使用同一 sessionId，否则同一 profile 会被两个实例打开（Chromium 锁冲突）
   * 或探针（browserRuntime.withPage(sessionId)）找不到实例。
   */
  async resolveSessionId(channelAccountId: string, platform?: string | null): Promise<string> {
    const p = platform || (await this.getChannelType(channelAccountId))
    return `${p}:${channelAccountId}`
  }

  /** 查账号平台类型（channelType），查不到回退 douyin */
  private async getChannelType(channelAccountId: string): Promise<string> {
    try {
      const acc = await prisma.enterpriseChannelAccount.findUnique({
        where: { id: channelAccountId },
        select: { channelType: true },
      })
      return acc?.channelType || 'douyin'
    } catch {
      return 'douyin'
    }
  }

  /**
   * 获取或创建 workspace（by channelAccountId）
   * - 已存在：返回现有记录（幂等）
   * - 不存在：创建（CREATED 状态，profilePath 按企业/账号分层）
   * - businessType：工作电脑所属业务域（默认 media，兼容存量抖音工作空间）
   */
  async getOrCreate(tenantId: string, organizationId: string, channelAccountId: string, businessType = 'media'): Promise<BrowserWorkspaceRecord> {
    const existing = await prisma.browserWorkspace.findUnique({
      where: { channelAccountId },
    })
    if (existing) {
      // SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 Task03: 禁止跨 org 引用已有 workspace
      if (existing.organizationId !== organizationId) {
        throw new Error('WORKSPACE_NOT_IN_ORG: 该账号的工作空间不属于当前组织')
      }
      return this.map(existing)
    }

    const channelType = await this.getChannelType(channelAccountId)
    const profilePath = this.getProfilePath(channelType, channelAccountId)
    const created = await prisma.browserWorkspace.create({
      data: {
        tenantId,
        organizationId,
        channelAccountId,
        businessType,
        workspaceType: 'chrome',
        profilePath,
        status: 'CREATED',
        metadata: {},
      },
    })
    console.log(`[BrowserWorkspace] created org=${organizationId} account=${channelAccountId} domain=${businessType} profile=${profilePath}`)
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

  /**
   * 按组织 + 业务域查询（Domain Boundary Fix）
   * 隔离：organizationId + businessType 双条件，防止跨域串线
   */
  async listByOrganizationAndDomain(organizationId: string, businessType: string): Promise<BrowserWorkspaceRecord[]> {
    const rows = await prisma.browserWorkspace.findMany({
      where: { organizationId, businessType },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(r => this.map(r))
  }

  /** 业务域校验：workspace 归属域与期望域一致，否则拒绝（防跨域访问） */
  async assertDomain(id: string, expectedDomain: string): Promise<BrowserWorkspaceRecord> {
    const ws = await this.findById(id)
    if (!ws) throw new Error(`BrowserWorkspace not found: ${id}`)
    if (ws.businessType !== expectedDomain) {
      throw new Error(`BrowserWorkspace 业务域不匹配: ${ws.businessType} ≠ ${expectedDomain}（跨域访问被拒绝）`)
    }
    return ws
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
      businessType: row.businessType || 'media',
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
