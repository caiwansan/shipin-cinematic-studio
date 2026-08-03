// SPRINT-MEDIA-TENANT-ISOLATION-FIX-02 — 渠道账号访问控制核心
// 掌柜批准方案 A：ChannelAccount = 用户私有资产（ownerId 第一归属）
// 可访问 = owner 本人（全权限）∪ ChannelAccountShare 被授权人（按 permission 分级）
// 禁止：企业成员默认共享 / 知道 id 即可访问（IDOR）/ 改 ownerId 绕过授权
import type { PrismaClient } from '@prisma/client'

export type ChannelPermission = 'READ' | 'ANALYZE' | 'MANAGE'

// MANAGE ⊃ ANALYZE ⊃ READ
const PERMISSION_RANK: Record<ChannelPermission, number> = { READ: 1, ANALYZE: 2, MANAGE: 3 }

export class ChannelAccessService {
  constructor(private readonly prisma: PrismaClient) {}

  /** 当前用户可访问的账号 id 集 = 自己拥有的 ∪ 被授权（未过期）的 */
  async getAccessibleAccountIds(userId: string): Promise<string[]> {
    const [owned, shared] = await Promise.all([
      this.prisma.enterpriseChannelAccount.findMany({
        where: { ownerId: userId },
        select: { id: true },
      }),
      this.prisma.channelAccountShare.findMany({
        where: {
          granteeUserId: userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { channelAccountId: true },
      }),
    ])
    return [...new Set([...owned.map((o) => o.id), ...shared.map((s) => s.channelAccountId)])]
  }

  /** 单账号访问校验（详情/操作/扫码前）：owner 全权限；grantee 按权限分级；过期=拒绝 */
  async canAccess(
    userId: string,
    accountId: string,
    permission: ChannelPermission = 'READ'
  ): Promise<boolean> {
    const account = await this.prisma.enterpriseChannelAccount.findUnique({
      where: { id: accountId },
      select: { ownerId: true },
    })
    if (!account) return false
    if (account.ownerId === userId) return true
    const share = await this.prisma.channelAccountShare.findFirst({
      where: {
        channelAccountId: accountId,
        granteeUserId: userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    if (!share) return false
    return PERMISSION_RANK[share.permission as ChannelPermission] >= PERMISSION_RANK[permission]
  }

  /** 校验不通过抛 403（路由用） */
  async assertAccess(userId: string, accountId: string, permission: ChannelPermission = 'READ') {
    const ok = await this.canAccess(userId, accountId, permission)
    if (!ok) {
      const err: any = new Error('无权访问该渠道账号（需账号所有者授权）')
      err.statusCode = 403
      err.code = 'CHANNEL_ACCESS_DENIED'
      throw err
    }
  }
}
