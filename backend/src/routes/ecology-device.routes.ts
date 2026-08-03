/**
 * SPRINT-ECO-11.2 — Kunlun Desktop Shell Device Routes
 * 设备注册 / 心跳 / 吊销 / 应用安装 / 授权状态读取（设备级语义）
 *
 * 掌柜冻结（2026-08-04）：
 *   - B 设备级授权 MVP；随机 device_id + 签名 token + 用户确认（登录 JWT = 确认）
 *   - ❌ 硬件绑定；只新增 ecology_* 表；不碰现有业务
 * Gate：G3 设备注册 / G4 重启恢复 / G5 License 预演（设备隔离）/ G6 工作台回归
 */
import type { FastifyInstance } from 'fastify';
import { DeviceService, DeviceServiceError } from '../ecosystem/device.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

export async function registerEcologyDeviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getService = async (): Promise<{ devices: DeviceService; prisma: any }> => {
    const { prisma } = await import('../utils/index.js');
    return { devices: new DeviceService(prisma), prisma };
  };

  const resolveOrg = async (request: any): Promise<string> => {
    const orgId = await getOrganizationIdForUser(request.user?.id).catch(() => null);
    if (!orgId) throw new DeviceServiceError('无法解析组织身份', 'NO_ORGANIZATION');
    return orgId;
  };

  const replyErr = (reply: any, e: any) => {
    if (e instanceof DeviceServiceError) {
      const code = ['DEVICE_NOT_FOUND', 'APP_NOT_FOUND'].includes(e.code) ? 404 : 403;
      return reply.code(code).send({ code, message: e.message, errorCode: e.code });
    }
    return reply.code(500).send({ code: 500, message: `Device 服务异常: ${e.message}` });
  };

  /**
   * POST /api/ecosystem/devices/register — G3 设备注册（首次启动）
   * body: { deviceName?, os?, deviceFingerprint? }
   * 用户确认 = 已登录 JWT（Steam/Adobe 激活模式：登录即绑定）
   * → { device, token }（token 仅此一次返回，服务端只存哈希）
   */
  app.post('/devices/register', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices } = await getService();
      const result = await devices.registerDevice({
        organizationId,
        userId: request.user?.id,
        deviceName: request.body?.deviceName,
        os: request.body?.os,
        deviceFingerprint: request.body?.deviceFingerprint,
      });
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/devices/:deviceId/heartbeat — 设备心跳（凭据鉴权）
   * body: { token }
   * → { status, allowed }；REVOKED/DISABLED → allowed:false（本地强制登出信号）
   */
  app.post('/devices/:deviceId/heartbeat', async (request: any, reply: any) => {
    try {
      const { devices } = await getService();
      const result = await devices.heartbeat(request.params?.deviceId, request.body?.token);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * GET /api/ecosystem/devices — G4 组织设备列表（重启恢复：本地 deviceId 查回状态）
   */
  app.get('/devices', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices } = await getService();
      const list = await devices.listDevicesByOrganization(organizationId);
      return reply.send({ code: 0, data: { devices: list } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * GET /api/ecosystem/devices/me — 单设备状态（重启恢复用，必须属于当前组织）
   */
  app.get('/devices/me', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices } = await getService();
      const device = await devices.getDevice(request.query?.deviceId);
      if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
      // 组织隔离：设备必须属于请求者组织
      const full = await (await getService()).prisma.ecologyDevice.findUnique({
        where: { deviceId: request.query?.deviceId },
      });
      if (!full || full.organizationId !== organizationId) {
        throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
      }
      return reply.send({ code: 0, data: { device } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/devices/:deviceId/revoke — 吊销设备（组织内；吊销后 heartbeat 403）
   */
  app.post('/devices/:deviceId/revoke', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices, prisma } = await getService();
      const device = await prisma.ecologyDevice.findUnique({ where: { deviceId: request.params?.deviceId } });
      if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
      if (device.organizationId !== organizationId) {
        throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
      }
      const result = await devices.revokeDevice(request.params?.deviceId, request.user?.id);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/devices/:deviceId/apps/install — 本地应用安装记录
   * body: { applicationSlug, version?, installPath? }
   */
  app.post('/devices/:deviceId/apps/install', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices, prisma } = await getService();
      const device = await prisma.ecologyDevice.findUnique({ where: { deviceId: request.params?.deviceId } });
      if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
      if (device.organizationId !== organizationId) {
        throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
      }
      const result = await devices.installLocalApp({
        organizationId,
        deviceId: request.params?.deviceId,
        applicationSlug: request.body?.applicationSlug,
        version: request.body?.version,
        installPath: request.body?.installPath,
      });
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/devices/:deviceId/apps/:slug/uninstall — 卸载（保留历史）
   */
  app.post('/devices/:deviceId/apps/:slug/uninstall', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices, prisma } = await getService();
      const device = await prisma.ecologyDevice.findUnique({ where: { deviceId: request.params?.deviceId } });
      if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
      if (device.organizationId !== organizationId) {
        throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
      }
      const result = await devices.uninstallLocalApp(request.params?.deviceId, request.params?.slug);
      return reply.send({ code: 0, data: result });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * GET /api/ecosystem/devices/:deviceId/authorized-plugins — G5 设备授权状态读取
   * 语义：该设备所属组织的有效 License（ACTIVE 且未过期）+ 设备状态。
   * 设备隔离预演：设备 A（有授权 org）→ allowed 列表；设备 B（其他 org/未注册）→ denied。
   */
  app.get('/devices/:deviceId/authorized-plugins', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { devices, prisma } = await getService();
      const device = await prisma.ecologyDevice.findUnique({ where: { deviceId: request.params?.deviceId } });
      if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
      if (device.organizationId !== organizationId) {
        throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
      }
      const plugins = await devices.listAuthorizedPluginsForDevice(request.params?.deviceId);
      return reply.send({ code: 0, data: { deviceStatus: device.status, plugins } });
    } catch (e: any) { return replyErr(reply, e); }
  });

  /**
   * POST /api/ecosystem/devices/:deviceId/launch-check — G5 设备级启动校验（License 预演）
   * body: { pluginId }
   * → allowed:true（设备 ACTIVE + License ACTIVE + 组织匹配）
   * → allowed:false + reason（NO_LICENSE / EXPIRED / SUSPENDED / DEVICE_REVOKED / DEVICE_ORG_MISMATCH）
   */
  app.post('/devices/:deviceId/launch-check', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrg(request);
      const { prisma } = await getService();
      const device = await prisma.ecologyDevice.findUnique({ where: { deviceId: request.params?.deviceId } });
      if (!device) {
        return reply.send({ code: 0, data: { allowed: false, reason: 'DEVICE_NOT_FOUND', deviceStatus: null } });
      }
      if (device.organizationId !== organizationId) {
        return reply.send({ code: 0, data: { allowed: false, reason: 'DEVICE_ORG_MISMATCH', deviceStatus: device.status } });
      }
      if (device.status !== 'ACTIVE') {
        return reply.send({ code: 0, data: { allowed: false, reason: `DEVICE_${device.status}`, deviceStatus: device.status } });
      }
      const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId: request.body?.pluginId } });
      if (!plugin) {
        return reply.send({ code: 0, data: { allowed: false, reason: 'PLUGIN_NOT_FOUND', deviceStatus: device.status } });
      }
      const license = await prisma.ecologyLicense.findUnique({
        where: { organizationId_pluginId: { organizationId: device.organizationId, pluginId: plugin.id } },
      });
      if (!license) {
        return reply.send({ code: 0, data: { allowed: false, reason: 'NO_LICENSE', deviceStatus: device.status } });
      }
      if (license.status === 'EXPIRED' || license.expireAt <= new Date()) {
        return reply.send({ code: 0, data: { allowed: false, reason: 'EXPIRED', deviceStatus: device.status } });
      }
      if (license.status === 'SUSPENDED') {
        return reply.send({ code: 0, data: { allowed: false, reason: 'SUSPENDED', deviceStatus: device.status } });
      }
      // 设备级启动校验通过 → 记录审计（ecology_license_check_logs，source=local_app 语义）
      await prisma.ecologyLicenseCheckLog.create({
        data: {
          organizationId: device.organizationId,
          pluginId: plugin.pluginId,
          licenseId: license.id,
          result: 'allowed',
          reason: 'OK',
          source: 'local_app',
          machineId: device.deviceId,
        },
      });
      return reply.send({ code: 0, data: { allowed: true, reason: 'OK', deviceStatus: device.status, licenseId: license.id, expireAt: license.expireAt } });
    } catch (e: any) { return replyErr(reply, e); }
  });
}
