/**
 * SPRINT-ECO-06 — Marketplace Foundation Routes
 * 生态商品与交易基础设施 API（只登记 / 只联动 / 不执行）
 * 链路：Plugin → APPROVED → Listing → Install → License ACTIVE → KAOR Load（未来）→ Plugin Available
 * 纪律：不做商城 UI / 不做支付 / 不做推广 / 不提现 / 不分佣计算
 * Gate：G1 发布权限 / G2 安装授权联动 / G3 卸载不删历史 / G4 未授权不可运行
 */
import type { FastifyInstance } from 'fastify';
import { MarketplaceService, MarketplaceServiceError } from '../ecosystem/marketplace.service.js';
import { LicenseService } from '../ecosystem/license.service.js';
import { DeveloperService, DeveloperServiceError } from '../ecosystem/developer.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologyMarketplaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getServices = async (): Promise<{ marketplace: MarketplaceService; license: LicenseService; developer: DeveloperService; prisma: any }> => {
    const { prisma } = await import('../utils/index.js');
    const license = new LicenseService(prisma);
    return { marketplace: new MarketplaceService(prisma, license), license, developer: new DeveloperService(prisma), prisma };
  };

  /** 从 JWT user 解析组织 ID（G8 隔离语义延续） */
  const resolveOrg = async (request: any): Promise<string> => {
    const orgId = await getOrganizationIdForUser(request.user?.id).catch(() => null);
    if (!orgId) throw new MarketplaceServiceError('无法解析组织身份', 'NO_ORGANIZATION');
    return orgId;
  };

  /** 当前用户开发者（必须已注册） */
  const resolveDeveloper = async (request: any): Promise<any> => {
    const { developer } = await getServices();
    const dev = await developer.getDeveloperByUserId(request.user?.id);
    if (!dev) throw new MarketplaceServiceError('尚未注册开发者身份', 'DEVELOPER_NOT_REGISTERED');
    return dev;
  };

  const replyErr = (reply: any, e: any) => {
    if (e instanceof MarketplaceServiceError || e instanceof DeveloperServiceError) {
      const code = ['DEVELOPER_NOT_REGISTERED', 'PLUGIN_NOT_FOUND', 'ITEM_NOT_FOUND', 'NOT_LISTED', 'NOT_INSTALLED', 'ITEM_UNLISTED', 'PLUGIN_NOT_PUBLISHED', 'INVALID_PERIOD'].includes(e.code) ? 400 : 403;
      return reply.code(code).send({ code, message: e.message, errorCode: e.code });
    }
    return reply.code(500).send({ code: 500, message: `Marketplace 服务异常: ${e.message}` });
  };

  /**
   * POST /api/ecosystem/marketplace/items — G1 上架登记（仅插件作者）
   * body: { pluginId, displayName?, description?, category?, pricingModel? }
   */
  app.post('/marketplace/items', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      const { marketplace } = await getServices();
      const result = await marketplace.listPlugin(dev.id, request.body?.pluginId, {
        displayName: request.body?.displayName,
        description: request.body?.description,
        category: request.body?.category,
        pricingModel: request.body?.pricingModel,
      });
      return reply.send({ code: 0, data: { item: result.item, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/marketplace/items/:pluginId/unlist — 下架（LISTED→UNLISTED，不删记录） */
  app.post('/marketplace/items/:pluginId/unlist', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      const { marketplace } = await getServices();
      const item = await marketplace.unlistPlugin(dev.id, request.params.pluginId);
      return reply.send({ code: 0, data: { item } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/marketplace/items — 插件发现（LISTED + 已安装标记）
   *  query: q=搜索词&category=agent&type=agent（ECO-10 发现中心过滤）
   */
  app.get('/marketplace/items', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const items = await marketplace.listMarketplace(organizationId, {
        q: request.query?.q,
        category: request.query?.category,
        type: request.query?.type,
      });
      return reply.send({ code: 0, data: { items, total: items.length } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/marketplace/items/:pluginId — 商品详情 */
  app.get('/marketplace/items/:pluginId', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const item = await marketplace.getMarketplaceItem(organizationId, request.params.pluginId);
      return reply.send({ code: 0, data: { item } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/marketplace/install — G2 安装授权联动
   * body: { pluginId } → INSTALL_REQUEST → License ACTIVE → INSTALLED
   */
  app.post('/marketplace/install', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const result = await marketplace.installPlugin(organizationId, request.body?.pluginId);
      return reply.send({ code: 0, data: { install: result.install, license: result.license, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/marketplace/uninstall — G3 卸载（REMOVED 不删行，license 保留历史）
   * body: { pluginId }
   */
  app.post('/marketplace/uninstall', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const result = await marketplace.uninstallPlugin(organizationId, request.body?.pluginId);
      return reply.send({ code: 0, data: { install: result.install, license: result.license, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/marketplace/installs — 当前组织安装列表 */
  app.get('/marketplace/installs', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const installs = await marketplace.listInstalls(organizationId);
      return reply.send({ code: 0, data: { installs } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/marketplace/revenue-snapshot — 结算数据快照登记（非结算）
   * body: { period: 'YYYY-MM' }  subscriptionCount=ACTIVE 许可真实聚合；grossAmount=0（未接支付）
   */
  app.post('/marketplace/revenue-snapshot', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { marketplace } = await getServices();
      const result = await marketplace.snapshotRevenue(request.body?.period);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/marketplace/revenue-snapshots?period=YYYY-MM — 快照列表 */
  app.get('/marketplace/revenue-snapshots', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { marketplace } = await getServices();
      const snapshots = await marketplace.listRevenueSnapshots(request.query?.period);
      return reply.send({ code: 0, data: { snapshots } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/marketplace/launch-check — G4 未授权启动校验（KAOR Load 前置语义）
   * body: { pluginId } → 未安装/无 License/过期 → 不可运行
   */
  app.post('/marketplace/launch-check', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { marketplace } = await getServices();
      const result = await marketplace.launchCheck(organizationId, request.body?.pluginId);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });
}
