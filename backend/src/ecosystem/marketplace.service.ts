/**
 * SPRINT-ECO-06 — Marketplace Foundation Service
 * 生态商品与交易基础设施：上架登记 + 插件发现 + 安装流程 + License 联动 + 结算数据快照
 *
 * 目标链路（掌柜）：Plugin → APPROVED → Listing → Install → License ACTIVE → KAOR Load（未来）→ Plugin Available
 *
 * Reality Gate：
 *   G1 发布权限 — 开发者 A 只能上架自己的插件（author 强校验）
 *   G2 安装授权联动 — 用户安装 → 生成 License → ACTIVE（复用 ECO-04 LicenseService.grantLicense）
 *   G3 卸载行为 — installation.status = REMOVED（不删行），license 保留历史
 *   G4 未授权启动 — 无 License / 未安装 → 插件不可运行（复用 checkLicense + install 状态）
 *
 * 纪律：不做商城 UI / 不做支付 / 不做推广 / 不提现 / 不分佣计算（ECO-07 Settlement 后置）
 */
import type { PrismaClient } from '@prisma/client';
import { LicenseService } from './license.service.js';

export type MarketplaceItemStatus = 'LISTED' | 'UNLISTED';
export type InstallStatus = 'INSTALL_REQUEST' | 'INSTALLED' | 'FAILED' | 'DISABLED' | 'REMOVED';
export type SnapshotStatus = 'DRAFT' | 'FINALIZED';

export class MarketplaceServiceError extends Error {
  constructor(message: string, public code: string = 'MARKETPLACE_ERROR') {
    super(message);
  }
}

export interface ListPluginParams {
  displayName?: string;
  description?: string;
  category?: string;
  pricingModel?: 'FREE' | 'TRIAL' | 'SUBSCRIPTION';
}

export class MarketplaceService {
  constructor(private prisma: PrismaClient, private licenseService: LicenseService) {}

  // ── G1: 上架登记（发布权限）────────────────────────────────

  /**
   * listPlugin：APPROVED 插件 → marketplace 上架（LISTED）
   * 权限：上架者必须是插件 author（G1 发布权限）
   * 前置：插件 status = PUBLISHED（ECO-05 APPROVED 审批后自动 PUBLISHED）
   */
  async listPlugin(actorDeveloperId: string, pluginEcologyId: string, params: ListPluginParams = {}) {
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { id: pluginEcologyId } });
    if (!plugin) throw new MarketplaceServiceError(`插件不存在: ${pluginEcologyId}`, 'PLUGIN_NOT_FOUND');
    const dev = await this.getDeveloperByIdOrThrow(actorDeveloperId);
    if (plugin.author !== dev.developerId) {
      throw new MarketplaceServiceError('仅插件作者可上架（发布权限）', 'AUTHOR_MISMATCH');
    }
    if (plugin.status !== 'PUBLISHED') {
      throw new MarketplaceServiceError(`仅 PUBLISHED 插件可上架（当前 ${plugin.status}），请先完成发布审批`, 'PLUGIN_NOT_PUBLISHED');
    }
    const existing = await this.prisma.ecologyMarketplaceItem.findUnique({ where: { pluginId: plugin.id } });
    const displayName = params.displayName ?? plugin.name;
    if (existing) {
      const updated = await this.prisma.ecologyMarketplaceItem.update({
        where: { id: existing.id },
        data: {
          developerId: dev.id,
          displayName,
          description: params.description ?? existing.description,
          category: params.category ?? existing.category,
          pricingModel: params.pricingModel ?? (existing.pricingModel as any) ?? 'FREE',
          status: 'LISTED',
          listedAt: existing.listedAt ?? new Date(),
        },
      });
      return { item: updated, idempotent: true };
    }
    const item = await this.prisma.ecologyMarketplaceItem.create({
      data: {
        pluginId: plugin.id,
        developerId: dev.id,
        displayName,
        description: params.description,
        category: params.category,
        pricingModel: params.pricingModel ?? 'FREE',
        status: 'LISTED',
        listedAt: new Date(),
      },
    });
    return { item, idempotent: false };
  }

  /** unlistPlugin：下架（LISTED → UNLISTED，不删记录） */
  async unlistPlugin(actorDeveloperId: string, pluginEcologyId: string) {
    const item = await this.prisma.ecologyMarketplaceItem.findUnique({ where: { pluginId: pluginEcologyId } });
    if (!item) throw new MarketplaceServiceError('该插件未上架', 'NOT_LISTED');
    const dev = await this.getDeveloperByIdOrThrow(actorDeveloperId);
    if (item.developerId !== dev.id) {
      throw new MarketplaceServiceError('仅插件作者可下架（发布权限）', 'AUTHOR_MISMATCH');
    }
    return this.prisma.ecologyMarketplaceItem.update({
      where: { id: item.id },
      data: { status: 'UNLISTED' },
    });
  }

  // ── 发现接口（商品目录）────────────────────────────────────

  /** listMarketplace：LISTED 商品 + 当前组织已安装标记 */
  /**
   * listMarketplace — 插件发现（LISTED + 已安装标记）
   * ECO-10 新增：q 搜索 / category 分类 / type 插件类型 服务端过滤
   */
  async listMarketplace(organizationId: string, filters: { q?: string; category?: string; type?: string } = {}) {
    const where: any = { status: 'LISTED' };
    if (filters.category) where.category = filters.category;
    if (filters.type) where.plugin = { type: filters.type };
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { displayName: { contains: q } },
        { description: { contains: q } },
        { plugin: { name: { contains: q } } },
        { plugin: { pluginId: { contains: q } } },
      ];
    }
    const items = await this.prisma.ecologyMarketplaceItem.findMany({
      where,
      include: {
        plugin: {
          select: {
            id: true, pluginId: true, name: true, type: true, description: true,
            manifest: true, status: true,
            versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 1, select: { version: true } },
          },
        },
        developer: { select: { developerId: true, developerName: true, status: true } },
      },
      orderBy: { listedAt: 'desc' },
    });
    const installed = await this.prisma.ecologyPluginInstall.findMany({
      where: { organizationId, status: { in: ['INSTALL_REQUEST', 'INSTALLED', 'DISABLED'] } },
      select: { pluginId: true, status: true, licenseId: true },
    });
    const installedMap = new Map(installed.map(i => [i.pluginId, i]));
    return items.map(item => ({
      id: item.id,
      pluginId: item.plugin.pluginId,
      pluginEcologyId: item.pluginId,
      displayName: item.displayName,
      description: item.description,
      category: item.category,
      pricingModel: item.pricingModel,
      price: item.price?.toString() ?? null,
      status: item.status,
      listedAt: item.listedAt,
      type: item.plugin.type,
      latestVersion: item.plugin.versions?.[0]?.version ?? null,
      developer: item.developer,
      install: installedMap.get(item.pluginId) ?? null,
    }));
  }

  // ── ECO-10：插件标识解析（兼容 ecology UUID 与 manifest pluginId）────
  /** 发现中心前端用 manifest.pluginId（ai-viral-analyst），ECO-06 gate 用 ecology UUID；统一解析 */
  private async resolvePluginEcologyId(pluginIdOrManifestId: string): Promise<string> {
    const byId = await this.prisma.ecologyPlugin.findUnique({
      where: { id: pluginIdOrManifestId }, select: { id: true },
    });
    if (byId) return byId.id;
    const byManifest = await this.prisma.ecologyPlugin.findUnique({
      where: { pluginId: pluginIdOrManifestId }, select: { id: true },
    });
    if (byManifest) return byManifest.id;
    return pluginIdOrManifestId; // 交给原逻辑报 ITEM_NOT_FOUND
  }

  /** getMarketplaceItem：商品详情（LISTED 或当前组织已安装）
   *  ECO-10 增强：返回 manifest（能力/权限）+ 关联应用（需要应用）
   */
  async getMarketplaceItem(organizationId: string, pluginIdOrManifestId: string) {
    const pluginEcologyId = await this.resolvePluginEcologyId(pluginIdOrManifestId);
    const item = await this.prisma.ecologyMarketplaceItem.findUnique({
      where: { pluginId: pluginEcologyId },
      include: {
        plugin: {
          select: {
            id: true, pluginId: true, name: true, type: true, description: true,
            manifest: true, status: true, applicationId: true,
            application: { select: { slug: true, name: true, workspaceEntry: true } },
            versions: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 1, select: { version: true, changelog: true } },
          },
        },
        developer: { select: { developerId: true, developerName: true, status: true } },
      },
    });
    if (!item) throw new MarketplaceServiceError('商品不存在', 'ITEM_NOT_FOUND');
    if (item.status !== 'LISTED') {
      throw new MarketplaceServiceError('商品已下架', 'ITEM_UNLISTED');
    }
    const install = await this.prisma.ecologyPluginInstall.findUnique({
      where: { organizationId_pluginId: { organizationId, pluginId: item.pluginId } },
    });
    return {
      ...item,
      install: install ?? null,
      manifest: item.plugin.manifest,
      application: item.plugin.application ?? null,
    };
  }

  // ── G2: 安装授权联动 ───────────────────────────────────────

  /**
   * installPlugin：用户安装 → License 联动
   *   1. 商品必须 LISTED
   *   2. installation → INSTALL_REQUEST
   *   3. LicenseService.grantLicense → ACTIVE（幂等：已有许可返回现有）
   *   4. installation → INSTALLED + licenseId 回填
   *   5. 任一步失败 → FAILED + 错误留痕（不删行）
   * 幂等：已 INSTALLED → 返回现有安装与许可
   */
  async installPlugin(organizationId: string, pluginIdOrManifestId: string) {
    const pluginEcologyId = await this.resolvePluginEcologyId(pluginIdOrManifestId);
    const item = await this.prisma.ecologyMarketplaceItem.findUnique({ where: { pluginId: pluginEcologyId } });
    if (!item) throw new MarketplaceServiceError('商品不存在（未上架）', 'ITEM_NOT_FOUND');
    if (item.status !== 'LISTED') throw new MarketplaceServiceError('商品已下架，无法安装', 'ITEM_UNLISTED');
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { id: item.pluginId } });
    if (!plugin) throw new MarketplaceServiceError('插件不存在', 'PLUGIN_NOT_FOUND');

    const existing = await this.prisma.ecologyPluginInstall.findUnique({
      where: { organizationId_pluginId: { organizationId, pluginId: item.pluginId } },
    });
    if (existing?.status === 'INSTALLED' || existing?.status === 'DISABLED') {
      const license = existing.licenseId
        ? await this.prisma.ecologyLicense.findUnique({ where: { id: existing.licenseId } })
        : null;
      return { install: existing, license, idempotent: true };
    }

    // 重新安装（REMOVED/FAILED 之后）：复用行，进入 INSTALL_REQUEST
    const install = existing
      ? await this.prisma.ecologyPluginInstall.update({
          where: { id: existing.id },
          data: { status: 'INSTALL_REQUEST', removedAt: null, licenseId: null },
        })
      : await this.prisma.ecologyPluginInstall.create({
          data: { organizationId, pluginId: item.pluginId, status: 'INSTALL_REQUEST' },
        });

    try {
      // 授权联动（ECO-04 复用：organizationId_pluginId 唯一许可）
      const granted = await this.licenseService.grantLicense({
        organizationId,
        pluginId: plugin.pluginId,
        licenseType: (item.pricingModel as any) === 'TRIAL' ? 'trial' : 'subscription',
        durationDays: 365,
      });
      const updated = await this.prisma.ecologyPluginInstall.update({
        where: { id: install.id },
        data: { status: 'INSTALLED', licenseId: granted.license.id, installedAt: new Date() },
      });
      return { install: updated, license: granted.license, idempotent: granted.idempotent };
    } catch (e: any) {
      await this.prisma.ecologyPluginInstall.update({
        where: { id: install.id },
        data: { status: 'FAILED' },
      });
      throw new MarketplaceServiceError(`安装失败（授权联动异常）: ${e.message}`, 'INSTALL_FAILED');
    }
  }

  // ── G3: 卸载行为（不删历史，license 保留）──────────────────

  /**
   * uninstallPlugin：卸载 = installation.status → REMOVED（不删行）
   * license 保留历史（不删除、不挂起、不失效——仅解除「当前安装」关系）
   */
  async uninstallPlugin(organizationId: string, pluginIdOrManifestId: string) {
    const pluginEcologyId = await this.resolvePluginEcologyId(pluginIdOrManifestId);
    const install = await this.prisma.ecologyPluginInstall.findUnique({
      where: { organizationId_pluginId: { organizationId, pluginId: pluginEcologyId } },
    });
    if (!install) throw new MarketplaceServiceError('未安装该插件', 'NOT_INSTALLED');
    if (install.status === 'REMOVED') return { install, idempotent: true };
    const updated = await this.prisma.ecologyPluginInstall.update({
      where: { id: install.id },
      data: { status: 'REMOVED', removedAt: new Date(), lifecycleState: 'DISABLED' },
    });
    // license 保留历史（G3：不删除）
    const license = install.licenseId
      ? await this.prisma.ecologyLicense.findUnique({ where: { id: install.licenseId } })
      : null;
    return { install: updated, license, idempotent: false };
  }

  // ── G4: 未授权启动校验 ─────────────────────────────────────

  /**
   * launchCheck：插件运行前校验（KAOR Load 前置语义）
   *   1. 未安装 / REMOVED → NOT_INSTALLED（插件不可运行）
   *   2. 无 License → NO_LICENSE（不可运行）
   *   3. License 非 ACTIVE → 对应原因（EXPIRED/SUSPENDED）
   *   4. 全部通过 → allowed（KAOR 可加载）
   */
  async launchCheck(organizationId: string, pluginIdOrManifestId: string) {
    const pluginEcologyId = await this.resolvePluginEcologyId(pluginIdOrManifestId);
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { id: pluginEcologyId } });
    if (!plugin) throw new MarketplaceServiceError('插件不存在', 'PLUGIN_NOT_FOUND');
    const install = await this.prisma.ecologyPluginInstall.findUnique({
      where: { organizationId_pluginId: { organizationId, pluginId: plugin.id } },
    });
    if (!install || install.status === 'REMOVED' || install.status === 'FAILED') {
      return { allowed: false, reason: 'NOT_INSTALLED', install: install ?? null, license: null };
    }
    const licenseCheck = await this.licenseService.checkLicense({ organizationId, pluginId: plugin.pluginId, source: 'kaor' });
    if (!licenseCheck.allowed) {
      return { allowed: false, reason: licenseCheck.reason, install, license: licenseCheck.license };
    }
    return { allowed: true, reason: 'OK', install, license: licenseCheck.license };
  }

  // ── 结算数据快照（非结算：只登记，ECO-07 Settlement 使用）──

  /**
   * snapshotRevenue：月度结算快照登记
   *   subscriptionCount = 该插件 ACTIVE 许可数（真实聚合）
   *   grossAmount = 0（未接支付体系，诚实不编造金额；ECO-07 由 license_events 计算）
   */
  async snapshotRevenue(period: string) {
    if (!/^(20\d{2})-(0[1-9]|1[0-2])$/.test(period)) throw new MarketplaceServiceError('period 必须为 YYYY-MM 且月份 01-12', 'INVALID_PERIOD');
    const activeLicenses = await this.prisma.ecologyLicense.findMany({
      where: { status: 'ACTIVE' },
      select: { pluginId: true },
    });
    const counts = new Map<string, number>();
    for (const l of activeLicenses) counts.set(l.pluginId, (counts.get(l.pluginId) ?? 0) + 1);
    const snapshots = [];
    for (const [pluginId, subscriptionCount] of counts) {
      const snapshot = await this.prisma.ecologyRevenueSnapshot.upsert({
        where: { pluginId_period: { pluginId, period } },
        create: { pluginId, period, subscriptionCount, grossAmount: 0, currency: 'CNY', status: 'DRAFT' },
        update: { subscriptionCount, grossAmount: 0 },
      });
      snapshots.push(snapshot);
    }
    return { period, pluginCount: snapshots.length, snapshots };
  }

  /** listRevenueSnapshots：快照列表（按插件维度） */
  async listRevenueSnapshots(period?: string) {
    return this.prisma.ecologyRevenueSnapshot.findMany({
      where: period ? { period } : undefined,
      include: { plugin: { select: { pluginId: true, name: true } } },
      orderBy: [{ period: 'desc' }, { pluginId: 'asc' }],
    });
  }

  /** listInstalls：当前组织安装列表 */
  async listInstalls(organizationId: string) {
    return this.prisma.ecologyPluginInstall.findMany({
      where: { organizationId },
      include: { plugin: { select: { pluginId: true, name: true, type: true } } },
      orderBy: { installedAt: 'desc' },
    });
  }

  // ── 内部 ───────────────────────────────────────────────────

  private async getDeveloperByIdOrThrow(developerId: string) {
    const dev = await this.prisma.ecologyDeveloper.findUnique({ where: { id: developerId } });
    if (!dev) throw new MarketplaceServiceError('开发者不存在', 'DEVELOPER_NOT_FOUND');
    if (dev.status === 'SUSPENDED') throw new MarketplaceServiceError('开发者已暂停，不可上架', 'DEVELOPER_SUSPENDED');
    return dev;
  }
}
