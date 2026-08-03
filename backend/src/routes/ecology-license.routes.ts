/**
 * SPRINT-ECO-04 — License & Entitlement Boundary Routes
 * 生态商业授权 API：只登记授权 / 只校验不执行 / 全事件审计
 * check 为平台无关语义（organizationId + pluginId + machineId 可选），支持未来
 * Kunlun Media.exe → KAOR → License Check → Plugin Load 链路（非纯网页授权）
 * 纪律：不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes / 不开发商城 UI
 */
import type { FastifyInstance } from 'fastify';
import { LicenseService, LicenseServiceError } from '../ecosystem/license.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologyLicenseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getService = async (): Promise<{ service: LicenseService; prisma: any }> => {
    const { prisma } = await import('../utils/index.js');
    return { service: new LicenseService(prisma), prisma };
  };

  /** 从 JWT user 解析组织 ID（G8 隔离：license 操作强制 org 归属） */
  const resolveOrg = async (request: any): Promise<string> => {
    const orgId = await getOrganizationIdForUser(request.user?.id).catch(() => null);
    if (!orgId) throw new LicenseServiceError('无法解析组织身份', 'NO_ORGANIZATION');
    return orgId;
  };

  /**
   * POST /api/ecosystem/license/grant — 授权（subscribe → ACTIVE，幂等）
   * body: { pluginId, pluginVersion?, licenseType?, durationDays?, expireAt?, sourceSubscriptionId?, machineId?, entitlements? }
   * organizationId 由 JWT 强制解析（客户端不可指定其他组织）
   */
  app.post('/license/grant', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { service } = await getService();
      const result = await service.grantLicense({ ...request.body, organizationId });
      return reply.send({ code: 0, data: { license: result.license, idempotent: result.idempotent } });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(404).send({ code: 404, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `授权失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/license/check — 运行校验（G7 核心：过期插件 denied）
   * body: { pluginId, source?, machineId? }  organizationId 由 JWT 解析
   * 平台无关：本地 App 可用同一语义（机器标识 machineId 预留）
   */
  app.post('/license/check', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { service } = await getService();
      const result = await service.checkLicense({ ...request.body, organizationId });
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(404).send({ code: 404, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `校验失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/license/check-many — 批量校验（KAOR 插件加载前调用）
   */
  app.post('/license/check-many', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { service } = await getService();
      const items: { pluginId: string; source?: string; machineId?: string }[] = request.body?.items ?? [];
      const results = await service.checkLicenses(items.map(i => ({ ...i, organizationId, source: (i.source ?? 'kaor') as 'kaor' | 'local_app' })));
      return reply.send({ code: 0, data: results });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `批量校验失败: ${e.message}` });
    }
  });

  /** GET /api/ecosystem/license/mine — 当前组织全部许可 */
  app.get('/license/mine', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { service } = await getService();
      const licenses = await service.listLicensesByOrganization(organizationId);
      return reply.send({ code: 0, data: { licenses, total: licenses.length } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `许可列表失败: ${e.message}` });
    }
  });

  /** GET /api/ecosystem/license/:licenseId — 许可详情（含插件信息） */
  app.get('/license/:licenseId', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const license = await service.getLicense(licenseId);
      if (!license) return reply.code(404).send({ code: 404, message: '许可不存在' });
      return reply.send({ code: 0, data: license });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `许可详情失败: ${e.message}` });
    }
  });

  /** GET /api/ecosystem/license/:licenseId/events — 授权事件审计（INSTALL/ACTIVATE/RENEW/EXPIRE/SUSPEND/RESTORE） */
  app.get('/license/:licenseId/events', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const events = await service.listEvents(licenseId);
      return reply.send({ code: 0, data: { events, total: events.length } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `事件查询失败: ${e.message}` });
    }
  });

  /** POST /api/ecosystem/license/:licenseId/renew — 续期（ACTIVE/EXPIRED → ACTIVE） */
  app.post('/license/:licenseId/renew', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const durationDays = request.body?.durationDays ?? 365;
      const license = await service.renewLicense(licenseId, durationDays, request.user?.email ?? request.user?.id);
      return reply.send({ code: 0, data: license });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(400).send({ code: 400, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `续期失败: ${e.message}` });
    }
  });

  /** POST /api/ecosystem/license/:licenseId/suspend — 暂停（ACTIVE → SUSPENDED） */
  app.post('/license/:licenseId/suspend', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const license = await service.suspendLicense(licenseId, request.body?.reason, request.user?.email ?? request.user?.id);
      return reply.send({ code: 0, data: license });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(400).send({ code: 400, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `暂停失败: ${e.message}` });
    }
  });

  /** POST /api/ecosystem/license/:licenseId/restore — 恢复（SUSPENDED → ACTIVE） */
  app.post('/license/:licenseId/restore', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const license = await service.restoreLicense(licenseId, request.user?.email ?? request.user?.id);
      return reply.send({ code: 0, data: license });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(400).send({ code: 400, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `恢复失败: ${e.message}` });
    }
  });

  /** POST /api/ecosystem/license/:licenseId/expire — 强制过期（ACTIVE/SUSPENDED → EXPIRED） */
  app.post('/license/:licenseId/expire', async (request: any, reply: any) => {
    try {
      const { licenseId } = request.params as { licenseId: string };
      const { service } = await getService();
      const license = await service.expireLicense(licenseId, request.body?.reason ?? 'MANUAL_EXPIRE', request.user?.email ?? request.user?.id);
      return reply.send({ code: 0, data: license });
    } catch (e: any) {
      if (e instanceof LicenseServiceError) return reply.code(400).send({ code: 400, message: e.message, errorCode: e.code });
      return reply.code(500).send({ code: 500, message: `过期失败: ${e.message}` });
    }
  });

  /** GET /api/ecosystem/license/checks/:organizationId — 校验日志（审计） */
  app.get('/license/checks/:organizationId', async (request: any, reply: any) => {
    try {
      const { organizationId } = request.params as { organizationId: string };
      const myOrg = await resolveOrg(request);
      if (organizationId !== myOrg) {
        return reply.code(403).send({ code: 403, message: '无权查看其他组织校验日志', errorCode: 'TENANT_CONTEXT_INVALID' });
      }
      const { service } = await getService();
      const logs = await service.listCheckLogs(organizationId);
      return reply.send({ code: 0, data: { logs, total: logs.length } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `校验日志失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/license/scan-due — 到期批量流转（ACTIVE/SUSPENDED → EXPIRED）
   * 幂等；供启动任务/定时任务调用
   */
  app.post('/license/scan-due', async (request: any, reply: any) => {
    try {
      const { service } = await getService();
      const expired = await service.expireDueLicenses();
      return reply.send({ code: 0, data: { expiredCount: expired } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `到期扫描失败: ${e.message}` });
    }
  });
}
