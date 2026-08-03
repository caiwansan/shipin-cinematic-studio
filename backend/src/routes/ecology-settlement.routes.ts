/**
 * SPRINT-ECO-07 — Revenue Settlement Foundation Routes
 * 收入计算基础设施 API（登记 / 计算 / 留痕，不执行任何资金操作）
 * 核心链：License → License Events → Revenue Snapshot → Settlement Record → Developer Share
 * 禁止：提现 / 钱包 / 支付改造 / 推广奖励 / 银行接口
 */
import type { FastifyInstance } from 'fastify';
import { RevenueSettlementService, SettlementServiceError } from '../ecosystem/settlement.service.js';
import { DeveloperService, DeveloperServiceError } from '../ecosystem/developer.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologySettlementRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getServices = async () => {
    const { prisma } = await import('../utils/index.js');
    return { settlement: new RevenueSettlementService(prisma), developer: new DeveloperService(prisma) };
  };

  const resolveOrg = async (request: any): Promise<string | null> => {
    return getOrganizationIdForUser(request.user?.id).catch(() => null);
  };

  /** 开发者隔离：当前用户 → EcologyDeveloper（无开发者身份 → 只读平台默认） */
  const resolveDeveloper = async (request: any): Promise<any> => {
    const { developer } = await getServices();
    return developer.getDeveloperByUserId(request.user?.id) ?? null;
  };

  const replyErr = (reply: any, e: any) => {
    if (e instanceof SettlementServiceError || e instanceof DeveloperServiceError) {
      const code = ['INVALID_PERIOD', 'NO_SNAPSHOT', 'NOT_FOUND', 'INVALID_STATUS', 'INVALID_RATE'].includes(e.code) ? 400 : 403;
      return reply.code(code).send({ code, message: e.message, errorCode: e.code });
    }
    return reply.code(500).send({ code: 500, message: `Settlement 服务异常: ${e.message}` });
  };

  /**
   * PUT /api/ecosystem/settlements/policies — G1 分成规则配置（配置化，不写死）
   * body: { developerId?, pluginId?, developerRate, platformRate? }  （全 null = 平台默认）
   */
  app.put('/settlements/policies', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const policy = await settlement.upsertPolicy({
        developerId: request.body?.developerId ?? null,
        pluginId: request.body?.pluginId ?? null,
        developerRate: request.body?.developerRate,
        platformRate: request.body?.platformRate,
      });
      return reply.send({ code: 0, data: { policy } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/settlements/policies — 策略列表 */
  app.get('/settlements/policies', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const policies = await settlement.listPolicies();
      return reply.send({ code: 0, data: { policies } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/settlements/settle — 生成周期结算
   * body: { period: 'YYYY-MM' }  快照确认 FINALIZED + 对账 + 分成计算 + settlements/items 落库
   */
  app.post('/settlements/settle', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const result = await settlement.settlePeriod(request.body?.period);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/settlements/reconcile?period=YYYY-MM — 对账报告（快照 vs license_events） */
  app.get('/settlements/reconcile', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const result = await settlement.reconcile(request.query?.period);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/settlements?period=&status= — 结算列表（开发者隔离：非作者只能看自己插件的结算） */
  app.get('/settlements', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement, developer } = await getServices();
      const dev = await developer.getDeveloperByUserId(request.user?.id);
      const list = await settlement.listSettlements({
        period: request.query?.period,
        status: request.query?.status,
        developerId: dev?.id,
      });
      return reply.send({ code: 0, data: { settlements: list } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/settlements/:id — 结算详情 + items（G2 可追溯） */
  app.get('/settlements/:id', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const s = await settlement.getSettlement(request.params.id);
      return reply.send({ code: 0, data: { settlement: s } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/settlements/:id/confirm — DRAFT → CONFIRMED */
  app.post('/settlements/:id/confirm', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const s = await settlement.confirmSettlement(request.params.id);
      return reply.send({ code: 0, data: { settlement: s } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/settlements/:id/finalize — CONFIRMED → FINALIZED（不可回退） */
  app.post('/settlements/:id/finalize', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { settlement } = await getServices();
      const s = await settlement.finalizeSettlement(request.params.id);
      return reply.send({ code: 0, data: { settlement: s } });
    } catch (e: any) { return replyErr(reply, e); }
  });
}
