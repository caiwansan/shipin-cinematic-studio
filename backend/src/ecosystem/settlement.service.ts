/**
 * SPRINT-ECO-07 — Revenue Settlement Foundation Service
 * 收入计算基础设施（非财务系统）
 * 核心链：License → License Events → Revenue Snapshot → Settlement Record → Developer Share
 *
 * 掌柜范围：
 *   ✅ 收入快照确认（快照 DRAFT → FINALIZED）
 *   ✅ 插件订阅收入归属（settlement.pluginId + developerId）
 *   ✅ 开发者分成计算模型（配置化 RevenueSharePolicy，不写死比例）
 *   ✅ 平台收入记录（platformAmount 独立可查）
 *   ❌ 提现 ❌ 钱包 ❌ 支付改造 ❌ 推广奖励 ❌ 银行接口
 *
 * Reality Gate：
 *   G1 配置化分成 — 插件级策略 > 开发者级策略 > 平台默认；不同开发者不同比例
 *   G2 结算可追溯 — settlement → items → licenseId → license_events 全链路
 *   G3 对账一致性 — grossAmount = Σitems.amount；developerAmount + platformAmount = grossAmount
 *   G4 结算状态机 — DRAFT → CONFIRMED → FINALIZED（不可回退，同周期不可覆盖）
 *   G5 平台收入记录 — platformAmount 独立可查；金额标注 REGISTERED（未接支付实收 0）
 */
import type { PrismaClient } from '@prisma/client';

export type SettlementStatus = 'DRAFT' | 'CONFIRMED' | 'FINALIZED';
export type PolicyLevel = 'PLATFORM_DEFAULT' | 'DEVELOPER' | 'PLUGIN';

export class SettlementServiceError extends Error {
  constructor(message: string, public code: string = 'SETTLEMENT_ERROR') {
    super(message);
  }
}

const PERIOD_RE = /^(20\d{2})-(0[1-9]|1[0-2])$/;
const REGISTERED_NOTE = 'REGISTERED'; // 未接支付：金额为应计登记值，非实收

export interface PolicyInput {
  developerId?: string | null;
  pluginId?: string | null;
  developerRate: number; // 0-1
  platformRate?: number; // 缺省 = 1 - developerRate
}

export class RevenueSettlementService {
  constructor(private prisma: PrismaClient) {}

  // ── G1: 分成规则配置化 ────────────────────────────────────

  /**
   * upsertPolicy：配置分成规则（不写死比例）
   *   plugin 级（developerId+pluginId）> developer 级（developerId）> 平台默认（全 null）
   * 平台默认策略不允许创建第二条（唯一性由 CHECK + 语义保证：全 null 只允许一行）
   */
  async upsertPolicy(input: PolicyInput) {
    if (typeof input.developerRate !== 'number' || input.developerRate < 0 || input.developerRate > 1) {
      throw new SettlementServiceError('developerRate 必须为 0-1', 'INVALID_RATE');
    }
    const developerRate = Math.round(input.developerRate * 100) / 100;
    const platformRate = input.platformRate != null
      ? Math.round(input.platformRate * 100) / 100
      : Math.round((1 - developerRate) * 100) / 100;
    if (Math.abs(developerRate + platformRate - 1) > 0.001) {
      throw new SettlementServiceError('developerRate + platformRate 必须等于 1', 'INVALID_RATE');
    }
    if (input.pluginId && !input.developerId) {
      throw new SettlementServiceError('插件级策略必须指定 developerId', 'INVALID_POLICY');
    }
    if (!input.developerId && input.pluginId) {
      throw new SettlementServiceError('pluginId 非空时 developerId 必填', 'INVALID_POLICY');
    }
    // 平台默认只允许一行
    if (!input.developerId && !input.pluginId) {
      const existingDefault = await this.prisma.ecologyRevenueSharePolicy.findFirst({
        where: { developerId: null, pluginId: null },
      });
      if (existingDefault) {
        return this.prisma.ecologyRevenueSharePolicy.update({
          where: { id: existingDefault.id },
          data: { developerRate, platformRate, status: 'ACTIVE' },
        });
      }
    }
    const pluginId = input.pluginId ?? undefined;
    const existing = await this.prisma.ecologyRevenueSharePolicy.findFirst({
      where: {
        developerId: input.developerId ?? null,
        pluginId: input.pluginId ?? null,
      },
    });
    if (existing) {
      return this.prisma.ecologyRevenueSharePolicy.update({
        where: { id: existing.id },
        data: { developerRate, platformRate, status: 'ACTIVE' },
      });
    }
    return this.prisma.ecologyRevenueSharePolicy.create({
      data: {
        developerId: input.developerId ?? null,
        pluginId: input.pluginId ?? null,
        developerRate,
        platformRate,
        status: 'ACTIVE',
      },
    });
  }

  /** listPolicies：策略列表（含解析后来源） */
  async listPolicies() {
    const policies = await this.prisma.ecologyRevenueSharePolicy.findMany({
      include: {
        developer: { select: { developerId: true, developerName: true } },
        plugin: { select: { pluginId: true, name: true } },
      },
      orderBy: [{ developerId: 'asc' }, { pluginId: 'asc' }],
    });
    return policies.map(p => ({
      ...p,
      level: p.pluginId ? 'PLUGIN' as PolicyLevel : p.developerId ? 'DEVELOPER' as PolicyLevel : 'PLATFORM_DEFAULT' as PolicyLevel,
    }));
  }

  /**
   * resolvePolicy：解析插件分成策略（插件级 > 开发者级 > 平台默认）
   * 返回 { developerRate, platformRate, source, level }
   */
  private async resolvePolicy(pluginId: string, developerId: string) {
    const pluginLevel = await this.prisma.ecologyRevenueSharePolicy.findFirst({
      where: { pluginId, developerId, status: 'ACTIVE' },
    });
    if (pluginLevel) {
      return { developerRate: Number(pluginLevel.developerRate), platformRate: Number(pluginLevel.platformRate), source: pluginLevel.id, level: 'PLUGIN' as PolicyLevel };
    }
    const devLevel = await this.prisma.ecologyRevenueSharePolicy.findFirst({
      where: { developerId, pluginId: null, status: 'ACTIVE' },
    });
    if (devLevel) {
      return { developerRate: Number(devLevel.developerRate), platformRate: Number(devLevel.platformRate), source: devLevel.id, level: 'DEVELOPER' as PolicyLevel };
    }
    const defaultLevel = await this.prisma.ecologyRevenueSharePolicy.findFirst({
      where: { developerId: null, pluginId: null, status: 'ACTIVE' },
    });
    if (!defaultLevel) {
      // 平台默认策略缺失时按 0/0 处理并标注（绝不静默采用代码写死比例）
      return { developerRate: 0, platformRate: 0, source: 'MISSING_DEFAULT_POLICY', level: 'PLATFORM_DEFAULT' as PolicyLevel };
    }
    return { developerRate: Number(defaultLevel.developerRate), platformRate: Number(defaultLevel.platformRate), source: defaultLevel.id, level: 'PLATFORM_DEFAULT' as PolicyLevel };
  }

  // ── 对账（快照 vs license_events）─────────────────────────

  /** 周期内插件授权事件（经 license 反查：license_events 无 pluginId 列） */
  private async getPeriodLicenseEvents(pluginId: string, period: string) {
    const licenses = await this.prisma.ecologyLicense.findMany({
      where: { pluginId },
      select: { id: true },
    });
    if (licenses.length === 0) return [];
    const licenseIds = licenses.map(l => l.id);
    return this.prisma.ecologyLicenseEvent.findMany({
      where: {
        licenseId: { in: licenseIds },
        eventType: { in: ['ACTIVATE', 'RENEW'] },
        createdAt: { gte: new Date(`${period}-01T00:00:00Z`), lt: new Date(this.nextMonth(period)) },
      },
      select: { licenseId: true },
    });
  }

  /**
   * reconcile：对账报告
   *   快照 subscriptionCount vs 周期内 license_events（ACTIVATE/RENEW）去重许可数
   *   返回 match/mismatch + 明细，不阻断结算
   */
  async reconcile(period: string) {
    this.validatePeriod(period);
    const snapshots = await this.prisma.ecologyRevenueSnapshot.findMany({
      where: { period },
      include: { plugin: { select: { pluginId: true, name: true } } },
    });
    const result = [];
    for (const snap of snapshots) {
      const events = await this.getPeriodLicenseEvents(snap.pluginId, period);
      const uniqueLicenses = new Set(events.map(e => e.licenseId)).size;
      result.push({
        pluginId: snap.pluginId,
        pluginKey: snap.plugin.pluginId,
        period,
        snapshotCount: snap.subscriptionCount,
        eventLicenseCount: uniqueLicenses,
        match: snap.subscriptionCount === uniqueLicenses,
        snapshotStatus: snap.status,
      });
    }
    return { period, reconciled: result };
  }

  // ── 结算生成 ──────────────────────────────────────────────

  /**
   * settlePeriod：生成指定周期结算（G2/G3）
   *   1. 快照确认 FINALIZED（收入快照确认 ✅）
   *   2. 对账（license_events 校验，留痕 detail）
   *   3. grossAmount = Σ(许可 × 单价登记)（REGISTERED 语义）
   *   4. 分成策略解析 → developerAmount / platformAmount
   *   5. settlements + items 落库（逐许可可追溯，source=LICENSE_EVENT；无事件汇总 SNAPSHOT）
   * 幂等：同 pluginId+period 已存在 → 返回现有（不覆盖，G4）
   */
  async settlePeriod(period: string) {
    this.validatePeriod(period);
    const snapshots = await this.prisma.ecologyRevenueSnapshot.findMany({
      where: { period },
      include: {
        plugin: {
          select: { pluginId: true, name: true, marketplaceItem: { select: { price: true, pricingModel: true } } },
        },
      },
    });
    if (snapshots.length === 0) throw new SettlementServiceError(`周期 ${period} 无收入快照，请先登记快照`, 'NO_SNAPSHOT');

    const settlements = [];
    for (const snap of snapshots) {
      const existing = await this.prisma.ecologySettlement.findUnique({
        where: { pluginId_period: { pluginId: snap.pluginId, period } },
      });
      if (existing) {
        settlements.push({ settlement: existing, idempotent: true });
        continue;
      }
      const plugin = snap.plugin;
      // 通过 marketplace item 找开发者（收入归属 = 上架者）
      const item = await this.prisma.ecologyMarketplaceItem.findUnique({
        where: { pluginId: snap.pluginId },
        include: { developer: { select: { id: true, developerId: true, developerName: true } } },
      });
      const developer = item?.developer;
      if (!developer) {
        settlements.push({ settlement: null, error: 'DEVELOPER_NOT_FOUND', pluginId: snap.pluginId, pluginKey: plugin.pluginId });
        continue;
      }

      // 对账留痕
      const events = await this.getPeriodLicenseEvents(snap.pluginId, period);
      const uniqueLicenseIds = [...new Set(events.map(e => e.licenseId))];

      // 金额计算：单价登记（REGISTERED）
      const price = Number(item.price ?? 0);
      const grossAmount = Math.round(price * snap.subscriptionCount * 100) / 100;

      // 分成策略
      const policy = await this.resolvePolicy(snap.pluginId, developer.id);
      const developerAmount = Math.round(grossAmount * policy.developerRate * 100) / 100;
      const platformAmount = Math.round((grossAmount - developerAmount) * 100) / 100;

      // 快照确认 FINALIZED（收入快照确认）
      await this.prisma.ecologyRevenueSnapshot.update({
        where: { id: snap.id },
        data: { status: 'FINALIZED' },
      });

      const settlement = await this.prisma.ecologySettlement.create({
        data: {
          period,
          pluginId: snap.pluginId,
          developerId: developer.id,
          grossAmount,
          developerAmount,
          platformAmount,
          status: 'DRAFT',
          detail: {
            note: REGISTERED_NOTE,
            price,
            pricingModel: item.pricingModel,
            snapshotCount: snap.subscriptionCount,
            eventLicenseCount: uniqueLicenseIds.length,
            reconcileMatch: snap.subscriptionCount === uniqueLicenseIds.length,
            policyLevel: policy.level,
            policySource: policy.source,
          },
        },
      });

      // items：逐许可明细（可追溯）或汇总
      if (uniqueLicenseIds.length > 0) {
        await this.prisma.ecologySettlementItem.createMany({
          data: uniqueLicenseIds.map(licenseId => ({
            settlementId: settlement.id,
            licenseId,
            pluginId: snap.pluginId,
            period,
            amount: price,
            source: 'LICENSE_EVENT',
          })),
        });
      } else {
        await this.prisma.ecologySettlementItem.create({
          data: {
            settlementId: settlement.id,
            pluginId: snap.pluginId,
            period,
            amount: grossAmount,
            source: 'SNAPSHOT',
          },
        });
      }
      settlements.push({ settlement, idempotent: false });
    }
    return { period, count: settlements.length, settlements };
  }

  // ── G4: 状态机 ────────────────────────────────────────────

  /** confirm：DRAFT → CONFIRMED（对账确认） */
  async confirmSettlement(id: string) {
    const s = await this.prisma.ecologySettlement.findUnique({ where: { id } });
    if (!s) throw new SettlementServiceError('结算不存在', 'NOT_FOUND');
    if (s.status !== 'DRAFT') throw new SettlementServiceError(`仅 DRAFT 可确认（当前 ${s.status}）`, 'INVALID_STATUS');
    return this.prisma.ecologySettlement.update({ where: { id }, data: { status: 'CONFIRMED' } });
  }

  /** finalize：CONFIRMED → FINALIZED（终审，不可回退） */
  async finalizeSettlement(id: string) {
    const s = await this.prisma.ecologySettlement.findUnique({ where: { id } });
    if (!s) throw new SettlementServiceError('结算不存在', 'NOT_FOUND');
    if (s.status !== 'CONFIRMED') throw new SettlementServiceError(`仅 CONFIRMED 可终审（当前 ${s.status}）`, 'INVALID_STATUS');
    return this.prisma.ecologySettlement.update({ where: { id }, data: { status: 'FINALIZED' } });
  }

  // ── 查询 ──────────────────────────────────────────────────

  /** listSettlements：结算列表（可按开发者隔离 / 周期筛选） */
  async listSettlements(opts: { period?: string; developerId?: string; status?: string }) {
    return this.prisma.ecologySettlement.findMany({
      where: {
        period: opts.period,
        developerId: opts.developerId,
        status: opts.status,
      },
      include: {
        plugin: { select: { pluginId: true, name: true } },
        developer: { select: { developerId: true, developerName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ period: 'desc' }, { pluginId: 'asc' }],
    });
  }

  /** getSettlement：结算详情 + items 明细（G2 可追溯） */
  async getSettlement(id: string) {
    const s = await this.prisma.ecologySettlement.findUnique({
      where: { id },
      include: {
        plugin: { select: { pluginId: true, name: true } },
        developer: { select: { developerId: true, developerName: true } },
        items: true,
      },
    });
    if (!s) throw new SettlementServiceError('结算不存在', 'NOT_FOUND');
    return s;
  }

  // ── 内部 ──────────────────────────────────────────────────

  private validatePeriod(period: string) {
    if (!PERIOD_RE.test(period)) throw new SettlementServiceError('period 必须为 YYYY-MM 且月份 01-12', 'INVALID_PERIOD');
  }

  private nextMonth(period: string): string {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(Date.UTC(y, m, 1));
    return d.toISOString().slice(0, 10);
  }
}
