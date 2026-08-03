/**
 * SPRINT-ECO-08 — Partner Revenue Share Foundation Service
 * SaaS Affiliate + Partner Revenue Share（掌柜冻结术语，不叫 MLM）
 *
 * 掌柜范围：
 *   ✅ 数据模型 ✅ 收益计算规则 ✅ 等级模型 ✅ 结算关系
 *   ❌ 推广页面 ❌ 邀请系统 ❌ 用户裂变 ❌ 奖励发放（仅 ACCRUED 应计，无 PAID 流程）
 *
 * 核心纪律：
 *   1. 收益来源唯一 = ecology_settlements（插件订阅真实收入）
 *      禁止 install/download/register/invite 作为收益依据
 *   2. 分红规则进配置表（ecology_partner_level_policies），不写死
 *   3. 小区算法：团队总业绩 - 最大业绩线 = 小区业绩
 *      例：A 树下 B=100万 C=30万 D=20万 → 去最大线 → 小区 = 30+20 = 50万
 *   4. 零污染：只新增 ecology_partner* 表，商业表/ecology_settlements 零改动
 */
import type { PrismaClient } from '@prisma/client';

export type PartnerLevelPolicy = {
  level: number;
  levelName: string;
  minPerformance: number;
  rewardRate: number;
  effectiveDate: Date;
  status: string;
};

export const FROZEN_LEVEL_NAMES = [
  '普通推广伙伴',
  '生态推广伙伴',
  '区域生态伙伴',
  '城市生态伙伴',
  '省级生态伙伴',
  '平台生态合伙人',
] as const;

// ── 纯函数（可单测，无 IO）────────────────────────────────

/**
 * 小区算法：团队总业绩 - 最大业绩线 = 小区业绩
 * @param teamPerformance 团队总业绩
 * @param directLinePerformances 各直接下线的团队业绩数组（可为空）
 */
export function computeSmallAreaPerformance(
  teamPerformance: number,
  directLinePerformances: number[],
): { maxLine: number; smallArea: number } {
  const maxLine = directLinePerformances.length > 0 ? Math.max(...directLinePerformances) : 0;
  const smallArea = Math.max(0, teamPerformance - maxLine);
  return { maxLine, smallArea };
}

/**
 * 等级判定：按 min_performance 从高到低取第一个达标等级（配置驱动，不写死）
 * @param smallAreaPerformance 小区业绩
 * @param policies 生效中的等级配置（按 level 升序）
 */
export function resolvePartnerLevel(
  smallAreaPerformance: number,
  policies: PartnerLevelPolicy[],
): PartnerLevelPolicy {
  const sorted = [...policies].sort((a, b) => b.minPerformance - a.minPerformance);
  const hit = sorted.find((p) => smallAreaPerformance >= p.minPerformance);
  if (!hit) {
    throw new Error('PARTNER_LEVEL_NOT_FOUND: 无命中等级配置（等级配置表必须有 level=1 兜底）');
  }
  return hit;
}

/** 应计分红（非实收） */
export function computeAccruedReward(smallAreaPerformance: number, rewardRate: number): number {
  return Math.round(smallAreaPerformance * rewardRate * 100) / 100;
}

// ── 服务（IO：prisma）──────────────────────────────────────

export class PartnerRevenueService {
  constructor(private prisma: PrismaClient) {}

  /** 生效中的等级配置（status=ACTIVE 且 effective_date <= now） */
  async getActivePolicies(): Promise<PartnerLevelPolicy[]> {
    const rows = await this.prisma.ecologyPartnerLevelPolicy.findMany({
      where: { status: 'ACTIVE', effectiveDate: { lte: new Date() } },
      orderBy: { level: 'asc' },
    });
    return rows.map((r) => ({
      level: r.level,
      levelName: r.levelName,
      minPerformance: Number(r.minPerformance),
      rewardRate: Number(r.rewardRate),
      effectiveDate: r.effectiveDate,
      status: r.status,
    }));
  }

  /**
   * 团队树递归：收集 partner 自身 + 所有后代 partner
   * （团队关系 = sponsor_partner_id 边；这是结算关系数据模型，非邀请系统）
   */
  async collectTeamPartnerIds(partnerId: string): Promise<string[]> {
    const team: string[] = [];
    const queue = [partnerId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      team.push(current);
      const children = await this.prisma.ecologyPartner.findMany({
        where: { sponsorPartnerId: current, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const c of children) queue.push(c.id);
    }
    return team;
  }

  /** 直接下线的团队业绩（递归，返回 [{partnerId, teamPerformance}]） */
  async computeDirectLinePerformances(partnerId: string, period: string): Promise<{ partnerId: string; teamPerformance: number }[]> {
    const children = await this.prisma.ecologyPartner.findMany({
      where: { sponsorPartnerId: partnerId, status: 'ACTIVE' },
      select: { id: true },
    });
    const lines: { partnerId: string; teamPerformance: number }[] = [];
    for (const child of children) {
      const teamPerformance = await this.computeTeamPerformance(child.id, period);
      lines.push({ partnerId: child.id, teamPerformance });
    }
    return lines;
  }

  /**
   * 团队总业绩 — 收益来源唯一：ecology_settlements
   * 团队内所有 partner 的组织集合 → 其下开发者的 settlement.gross_amount 求和
   * 禁止 install/download/register/invite 作为收益依据
   */
  async computeTeamPerformance(partnerId: string, period: string): Promise<number> {
    const teamIds = await this.collectTeamPartnerIds(partnerId);
    if (teamIds.length === 0) return 0;
    const partners = await this.prisma.ecologyPartner.findMany({
      where: { id: { in: teamIds } },
      select: { organizationId: true },
    });
    const orgIds = [...new Set(partners.map((p) => p.organizationId))];
    if (orgIds.length === 0) return 0;

    const rows = await this.prisma.$queryRawUnsafe<{ total: string | null }[]>(
      `SELECT COALESCE(SUM(s.gross_amount), 0) AS total
       FROM ecology_settlements s
       JOIN ecology_developers d ON d.id = s.developer_id
       WHERE d.organization_id IN (${orgIds.map((_, i) => `$${i + 1}`).join(',')})
         AND s.period = $${orgIds.length + 1}`,
      ...orgIds,
      period,
    );
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * 计算并保存某伙伴某周期的业绩快照（幂等 upsert）
   * 返回 { performance, accruedReward }
   */
  async computePerformance(partnerId: string, period: string) {
    const partner = await this.prisma.ecologyPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new Error('PARTNER_NOT_FOUND');
    if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(period)) throw new Error('INVALID_PERIOD: 必须 YYYY-MM');

    const teamPerformance = await this.computeTeamPerformance(partnerId, period);
    const directLines = await this.computeDirectLinePerformances(partnerId, period);
    const { maxLine, smallArea } = computeSmallAreaPerformance(
      teamPerformance,
      directLines.map((l) => l.teamPerformance),
    );

    const policies = await this.getActivePolicies();
    const levelPolicy = resolvePartnerLevel(smallArea, policies);
    const accruedReward = computeAccruedReward(smallArea, levelPolicy.rewardRate);

    const detail = {
      memberOrganizations: await this.getTeamOrganizationIds(partnerId),
      directLines,
      maxLinePartnerId: directLines.length > 0
        ? directLines.reduce((a, b) => (b.teamPerformance > a.teamPerformance ? b : a)).partnerId
        : null,
      revenueSource: 'ecology_settlements', // 收益来源唯一声明
      note: 'REGISTERED: 应计金额基于插件订阅收入，非实收',
    };

    const performance = await this.prisma.ecologyPartnerPerformance.upsert({
      where: { partnerId_period: { partnerId, period } },
      create: {
        partnerId,
        period,
        teamPerformance,
        maxLinePerformance: maxLine,
        smallAreaPerformance: smallArea,
        level: levelPolicy.level,
        rewardRate: levelPolicy.rewardRate,
        accruedReward,
        detail,
        status: 'COMPUTED',
      },
      update: {
        teamPerformance,
        maxLinePerformance: maxLine,
        smallAreaPerformance: smallArea,
        level: levelPolicy.level,
        rewardRate: levelPolicy.rewardRate,
        accruedReward,
        detail,
        status: 'COMPUTED',
      },
    });

    // 应计分红记录（ACCRUED 止；PAID 流程冻结）
    const reward = await this.prisma.ecologyPartnerReward.upsert({
      where: { partnerId_period: { partnerId, period } },
      create: {
        partnerId,
        period,
        performanceId: performance.id,
        rewardAmount: accruedReward,
        status: 'ACCRUED',
        detail: { revenueSource: 'ecology_settlements', note: '应计未发放' },
      },
      update: {
        performanceId: performance.id,
        rewardAmount: accruedReward,
        status: 'ACCRUED',
      },
    });

    return { performance, reward };
  }

  /** 团队组织集合（去重，detail 用） */
  private async getTeamOrganizationIds(partnerId: string): Promise<string[]> {
    const teamIds = await this.collectTeamPartnerIds(partnerId);
    const partners = await this.prisma.ecologyPartner.findMany({
      where: { id: { in: teamIds } },
      select: { organizationId: true },
    });
    return [...new Set(partners.map((p) => p.organizationId))];
  }

  /** 伙伴概况（只读） */
  async getOverview(partnerId: string) {
    const partner = await this.prisma.ecologyPartner.findUnique({
      where: { id: partnerId },
      include: {
        performances: { orderBy: { period: 'desc' }, take: 6 },
        rewards: { orderBy: { period: 'desc' }, take: 6 },
      },
    });
    if (!partner) throw new Error('PARTNER_NOT_FOUND');
    const policies = await this.getActivePolicies();
    const levelPolicy = policies.find((p) => p.level === partner.level) ?? null;
    return {
      partner: {
        id: partner.id,
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
        organizationId: partner.organizationId,
        sponsorPartnerId: partner.sponsorPartnerId,
        level: partner.level,
        levelName: levelPolicy?.levelName ?? null,
        status: partner.status,
      },
      performances: partner.performances,
      rewards: partner.rewards,
    };
  }
}
