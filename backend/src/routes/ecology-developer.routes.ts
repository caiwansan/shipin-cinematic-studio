/**
 * SPRINT-ECO-05 — Developer Center Foundation Routes
 * 开发者身份 + 插件发布基础 API（只登记 / 只留痕 / 不执行）
 * 链路：Developer → Plugin Author → Plugin Version → Review Status → Marketplace Ready
 * 纪律：不做开发者商城 / 不做收益提现 / 不做推广系统 / 不做审核后台 UI
 * 边界：G1 Author Ownership / G2 Permission Intersection / G3 Version Ownership
 */
import type { FastifyInstance } from 'fastify';
import { DeveloperService, DeveloperServiceError } from '../ecosystem/developer.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologyDeveloperRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getService = async (): Promise<{ service: DeveloperService; prisma: any }> => {
    const { prisma } = await import('../utils/index.js');
    return { service: new DeveloperService(prisma), prisma };
  };

  /** 从 JWT user 解析组织 ID（G8 隔离语义延续：开发者归属组织强制解析） */
  const resolveOrg = async (request: any): Promise<string> => {
    const orgId = await getOrganizationIdForUser(request.user?.id).catch(() => null);
    if (!orgId) throw new DeveloperServiceError('无法解析组织身份', 'NO_ORGANIZATION');
    return orgId;
  };

  /** 当前用户开发者（必须已注册） */
  const resolveDeveloper = async (request: any): Promise<any> => {
    const { service } = await getService();
    const dev = await service.getDeveloperByUserId(request.user?.id);
    if (!dev) throw new DeveloperServiceError('尚未注册开发者身份，请先 POST /developer/register', 'DEVELOPER_NOT_REGISTERED');
    return dev;
  };

  const replyErr = (reply: any, e: any) => {
    if (e instanceof DeveloperServiceError) return reply.code(e.code === 'DEVELOPER_NOT_REGISTERED' ? 400 : 403).send({ code: e.code === 'DEVELOPER_NOT_REGISTERED' ? 400 : 403, message: e.message, errorCode: e.code });
    return reply.code(500).send({ code: 500, message: `开发者服务异常: ${e.message}` });
  };

  /**
   * POST /api/ecosystem/developer/register — 注册开发者身份（CREATED）
   * body: { developerName }  userId/organizationId 由 JWT 强制解析
   */
  app.post('/developer/register', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { service } = await getService();
      const developerName = request.body?.developerName ?? `dev-${request.user?.id?.slice(0, 8)}`;
      const result = await service.registerDeveloper({ userId: request.user.id, organizationId, developerName });
      return reply.send({ code: 0, data: { developer: result.developer, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/developer/mine — 当前用户开发者身份 */
  app.get('/developer/mine', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      return reply.send({ code: 0, data: { developer: dev } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/developer/:developerId — 按公开 ID 查询 */
  app.get('/developer/:developerId', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const dev = await service.getDeveloper(request.params.developerId);
      if (!dev) return reply.code(404).send({ code: 404, message: '开发者不存在', errorCode: 'DEVELOPER_NOT_FOUND' });
      return reply.send({ code: 0, data: { developer: dev } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/developer/:developerId/verify — CREATED → VERIFIED（登记） */
  app.post('/developer/:developerId/verify', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const dev = await service.getDeveloper(request.params.developerId);
      if (!dev) return reply.code(404).send({ code: 404, message: '开发者不存在', errorCode: 'DEVELOPER_NOT_FOUND' });
      if (dev.userId !== request.user.id) return reply.code(403).send({ code: 403, message: '只能验证自己的开发者身份', errorCode: 'AUTHOR_MISMATCH' });
      const updated = await service.verifyDeveloper(dev.id);
      return reply.send({ code: 0, data: { developer: updated } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/developer/:developerId/suspend — → SUSPENDED */
  app.post('/developer/:developerId/suspend', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const dev = await service.getDeveloper(request.params.developerId);
      if (!dev) return reply.code(404).send({ code: 404, message: '开发者不存在', errorCode: 'DEVELOPER_NOT_FOUND' });
      if (dev.userId !== request.user.id) return reply.code(403).send({ code: 403, message: '只能暂停自己的开发者身份', errorCode: 'AUTHOR_MISMATCH' });
      const updated = await service.suspendDeveloper(dev.id);
      return reply.send({ code: 0, data: { developer: updated } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/developer/publish-requests — 创建发布申请（DRAFT）
   * body: { pluginId, versionId }  G1 作者归属 + G3 版本归属校验
   */
  app.post('/developer/publish-requests', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      const { service } = await getService();
      const result = await service.createPublishRequest({
        developerId: dev.id,
        pluginId: request.body?.pluginId,
        versionId: request.body?.versionId,
      });
      return reply.send({ code: 0, data: { request: result.request, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/developer/publish-requests?developerId=&status= */
  app.get('/developer/publish-requests', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      const { service } = await getService();
      const targetDev = request.query?.developerId ? await service.getDeveloper(request.query.developerId) : dev;
      if (targetDev && targetDev.userId !== request.user.id) {
        return reply.code(403).send({ code: 403, message: '无权查看他人发布申请', errorCode: 'AUTHOR_MISMATCH' });
      }
      const list = await service.listPublishRequests({
        developerId: targetDev ? targetDev.id : dev.id,
        status: request.query?.status,
      });
      return reply.send({ code: 0, data: { requests: list } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/developer/publish-requests/:id/submit — DRAFT → SUBMITTED（G2 权限交集校验） */
  app.post('/developer/publish-requests/:id/submit', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      const { service } = await getService();
      const updated = await service.submitPublishRequest(request.params.id, dev.id);
      return reply.send({ code: 0, data: { request: updated } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/developer/publish-requests/:id/approve — SUBMITTED → APPROVED（登记，插件→PUBLISHED） */
  app.post('/developer/publish-requests/:id/approve', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const updated = await service.approvePublishRequest(request.params.id, request.user?.id, request.body?.note);
      return reply.send({ code: 0, data: { request: updated } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** POST /api/ecosystem/developer/publish-requests/:id/reject — SUBMITTED → REJECTED（登记意见） */
  app.post('/developer/publish-requests/:id/reject', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const updated = await service.rejectPublishRequest(request.params.id, request.user?.id, request.body?.note);
      return reply.send({ code: 0, data: { request: updated } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/developer/permission-check — G2 权限交集校验预览
   * body: { pluginId, versionId }  返回交集与判定（不落库；携带当前开发者身份分级）
   */
  app.post('/developer/permission-check', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request).catch(() => null);
      const { service } = await getService();
      const result = await service.checkPermissionIntersection(request.body?.pluginId, request.body?.versionId, dev?.id);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/developer/:developerId/agreements — 签署协议留痕
   * body: { agreementType, version, content? }  幂等（同类型同版本已签返回现有）
   */
  app.post('/developer/:developerId/agreements', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      if (dev.developerId !== request.params.developerId) {
        return reply.code(403).send({ code: 403, message: '只能签署自己的开发者协议', errorCode: 'AUTHOR_MISMATCH' });
      }
      const { service } = await getService();
      const result = await service.signAgreement({
        developerId: dev.id,
        agreementType: request.body?.agreementType,
        version: request.body?.version,
        content: request.body?.content,
      });
      return reply.send({ code: 0, data: { agreement: result.agreement, idempotent: result.idempotent } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /** GET /api/ecosystem/developer/:developerId/agreements — 协议记录 */
  app.get('/developer/:developerId/agreements', async (request: any, reply: any) => {
    try {
      const dev = await resolveDeveloper(request);
      if (dev.developerId !== request.params.developerId) {
        return reply.code(403).send({ code: 403, message: '只能查看自己的开发者协议', errorCode: 'AUTHOR_MISMATCH' });
      }
      const { service } = await getService();
      const list = await service.listAgreements(dev.id);
      return reply.send({ code: 0, data: { agreements: list } });
    } catch (e: any) { return replyErr(reply, e); }
  });
}
