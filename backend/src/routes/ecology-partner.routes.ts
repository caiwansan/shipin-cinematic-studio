/**
 * SPRINT-ECO-08 — Partner Revenue Share Foundation Routes
 * SaaS Affiliate + Partner Revenue Share（掌柜冻结术语）
 *
 * 范围：✅ 等级配置只读 ✅ 伙伴概况只读 ✅ 业绩快照查询 ✅ 业绩重算（幂等）
 *      ❌ 推广页面 ❌ 邀请系统 ❌ 用户裂变 ❌ 奖励发放（仅 ACCRUED 应计）
 * 纪律：收益来源唯一 = ecology_settlements；分红规则配置表驱动；零污染
 */
import type { FastifyInstance } from 'fastify';
import { PartnerRevenueService } from '../ecosystem/partner-revenue.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologyPartnerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getService = async () => {
    const { prisma } = await import('../utils/index.js');
    return new PartnerRevenueService(prisma);
  };

  const resolveOrg = async (request: any): Promise<string | null> => {
    return getOrganizationIdForUser(request.user?.id).catch(() => null);
  };

  const replyErr = (reply: any, e: any) => {
    const msg = e?.message ?? String(e);
    if (msg.includes('PARTNER_NOT_FOUND')) return reply.code(404).send({ code: 404, message: msg });
    if (msg.includes('INVALID_PERIOD') || msg.includes('PARTNER_LEVEL_NOT_FOUND')) {
      return reply.code(400).send({ code: 400, message: msg });
    }
    return reply.code(500).send({ code: 500, message: `Partner 服务异常: ${msg}` });
  };

  /** GET /api/ecosystem/partner/levels — 等级配置只读（6 级冻结展示） */
  app.get('/partner/levels', async (_request: any, reply: any) => {
    try {
      const svc = await getService();
      const policies = await svc.getActivePolicies();
      return reply.send({ code: 0, data: { levels: policies } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/partner/overview?partnerId= — 伙伴概况只读 */
  app.get('/partner/overview', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const partnerId: string = request.query?.partnerId;
      if (!partnerId) return reply.code(400).send({ code: 400, message: 'partnerId 必填' });
      const svc = await getService();
      const data = await svc.getOverview(partnerId);
      return reply.send({ code: 0, data });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/partner/performance?partnerId=&period= — 业绩快照查询（只读） */
  app.get('/partner/performance', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { partnerId, period } = request.query ?? {};
      if (!partnerId || !period) return reply.code(400).send({ code: 400, message: 'partnerId 与 period 必填' });
      const { prisma } = await import('../utils/index.js');
      const perf = await prisma.ecologyPartnerPerformance.findUnique({
        where: { partnerId_period: { partnerId, period } },
      });
      return reply.send({ code: 0, data: { performance: perf } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/partner/performance/refresh — 重算业绩快照（幂等）
   * body: { partnerId, period }
   * 计算动作（收益计算规则范畴），非推广操作
   */
  app.post('/partner/performance/refresh', async (request: any, reply: any) => {
    try {
      await resolveOrg(request);
      const { partnerId, period } = request.body ?? {};
      if (!partnerId || !period) return reply.code(400).send({ code: 400, message: 'partnerId 与 period 必填' });
      const svc = await getService();
      const result = await svc.computePerformance(partnerId, period);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });
}
