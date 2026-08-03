/**
 * SPRINT-ECO-11.2 — Device Service（Kunlun Desktop Shell 设备层）
 * 掌柜冻结（2026-08-04）：
 *   - 设备授权策略 = B 设备级授权 MVP：Organization → Device → Local App → Plugin Runtime
 *   - 设备指纹 = 随机 device_id + 签名 token + 用户确认（Steam/Adobe 激活模式）
 *   - ❌ 禁止硬件绑定（CPU 序列号 / 硬盘序列号 / MAC 唯一绑定——换机客服成本）
 *   - 纪律：只新增 ecology_* 表；不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes
 *
 * 安全模型：
 *   - deviceToken 仅注册响应返回一次，服务端只存 SHA-256 哈希
 *   - heartbeat / 授权读取必须携带 deviceToken（设备凭据）
 *   - status=REVOKED 的设备 heartbeat 返回 403（吊销 = 本地强制登出信号）
 */
import type { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';

export class DeviceServiceError extends Error {
  constructor(message: string, public code: string = 'DEVICE_ERROR') {
    super(message);
  }
}

export type DeviceStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED';

export interface RegisterDeviceParams {
  organizationId: string;
  userId: string;
  deviceName?: string;
  os?: string;
  /** 客户端生成的随机指纹（uuid v4），服务端只存不逆向；禁止硬件序列号 */
  deviceFingerprint?: string;
}

export interface DeviceTokenPayload {
  deviceId: string;
  token: string;
}

export class DeviceService {
  constructor(private prisma: PrismaClient) {}

  /** SHA-256 设备 token 哈希（服务端永不存明文） */
  static hashToken(deviceId: string, token: string): string {
    return createHash('sha256').update(`${deviceId}:${token}`).digest('hex');
  }

  /** 生成设备 token（密码学随机 32 字节 hex） */
  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  // ── 注册（用户确认 = 已登录 JWT；注册即激活绑定，Steam/Adobe 模式）──

  async registerDevice(params: RegisterDeviceParams): Promise<{ device: any; token: string }> {
    const deviceId = randomUUID();
    const token = DeviceService.generateToken();
    const fingerprint = params.deviceFingerprint ?? randomUUID();

    const device = await this.prisma.ecologyDevice.create({
      data: {
        deviceId,
        organizationId: params.organizationId,
        userId: params.userId,
        deviceName: params.deviceName ?? null,
        deviceFingerprint: fingerprint,
        os: params.os ?? null,
        status: 'ACTIVE',
        deviceTokenHash: DeviceService.hashToken(deviceId, token),
        lastHeartbeat: new Date(),
      },
    });
    // 返回脱敏设备信息 + token（仅此一次）
    return { device: this.toPublicDevice(device), token };
  }

  // ── 心跳（设备凭据鉴权；吊销/禁用信号）──

  async heartbeat(deviceId: string, token: string): Promise<{ status: DeviceStatus; allowed: boolean }> {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.deviceTokenHash !== DeviceService.hashToken(deviceId, token)) {
      throw new DeviceServiceError('设备凭据无效', 'DEVICE_TOKEN_INVALID');
    }
    if (device.status === 'REVOKED' || device.status === 'DISABLED') {
      // 吊销/禁用设备：仍更新心跳但返回禁止（本地应强制登出）
      await this.prisma.ecologyDevice.update({
        where: { id: device.id },
        data: { lastHeartbeat: new Date() },
      });
      return { status: device.status as DeviceStatus, allowed: false };
    }
    await this.prisma.ecologyDevice.update({
      where: { id: device.id },
      data: { lastHeartbeat: new Date() },
    });
    return { status: 'ACTIVE', allowed: true };
  }

  // ── 吊销（组织内操作，owner 权限由路由层校验）──

  async revokeDevice(deviceId: string, actorUserId?: string): Promise<{ device: any }> {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    const updated = await this.prisma.ecologyDevice.update({
      where: { id: device.id },
      data: { status: 'REVOKED' },
    });
    return { device: this.toPublicDevice(updated) };
  }

  // ── 查询 ────────────────────────────────────────────────────

  async getDevice(deviceId: string): Promise<any | null> {
    const device = await this.prisma.ecologyDevice.findUnique({
      where: { deviceId },
      include: { localApps: true },
    });
    if (!device) return null;
    // 手动补充应用身份（EcologyLocalApp 无 application 外键，避免 schema 膨胀）
    const enriched = await this.enrichLocalApps(device.localApps);
    return this.toPublicDevice({ ...device, localApps: enriched });
  }

  async listDevicesByOrganization(organizationId: string) {
    const devices = await this.prisma.ecologyDevice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { localApps: true },
    });
    return Promise.all(devices.map(async (d) => {
      const enriched = await this.enrichLocalApps(d.localApps);
      return this.toPublicDevice({ ...d, localApps: enriched });
    }));
  }

  // ── Local App（设备 ↔ 应用安装记录；卸载不删行）──

  async installLocalApp(params: { organizationId: string; deviceId: string; applicationSlug: string; version?: string; installPath?: string }) {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId: params.deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.organizationId !== params.organizationId) {
      throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
    }
    const app = await this.prisma.ecologyApplication.findUnique({ where: { slug: params.applicationSlug } });
    if (!app) throw new DeviceServiceError(`应用不存在: ${params.applicationSlug}`, 'APP_NOT_FOUND');

    const existing = await this.prisma.ecologyLocalApp.findUnique({
      where: { deviceId_applicationId: { deviceId: device.id, applicationId: app.id } },
    });
    if (existing) {
      const updated = await this.prisma.ecologyLocalApp.update({
        where: { id: existing.id },
        data: {
          status: 'INSTALLED',
          version: params.version ?? existing.version,
          installPath: params.installPath ?? existing.installPath,
        },
      });
      return { app: this.toPublicLocalApp(updated), idempotent: true };
    }
    const created = await this.prisma.ecologyLocalApp.create({
      data: {
        organizationId: params.organizationId,
        deviceId: device.id,
        applicationId: app.id,
        version: params.version ?? '1.0.0',
        installPath: params.installPath ?? null,
        status: 'INSTALLED',
      },
    });
    return { app: this.toPublicLocalApp(created), idempotent: false };
  }

  async uninstallLocalApp(deviceId: string, applicationSlug: string) {
    const app = await this.prisma.ecologyApplication.findUnique({ where: { slug: applicationSlug } });
    if (!app) throw new DeviceServiceError(`应用不存在: ${applicationSlug}`, 'APP_NOT_FOUND');
    const local = await this.prisma.ecologyLocalApp.findUnique({
      where: { deviceId_applicationId: { deviceId, applicationId: app.id } },
    });
    if (!local) return { idempotent: true };
    // 卸载不删行（保留历史，ECO-06 G3 语义延续）
    const updated = await this.prisma.ecologyLocalApp.update({
      where: { id: local.id },
      data: { status: 'UNINSTALLED' },
    });
    return { app: this.toPublicLocalApp(updated), idempotent: false };
  }

  // ── 设备级插件授权状态（Shell「显示已安装插件 + 授权状态」）──
  // License 仍为组织级（ecology_licenses 不动）；设备级语义 = 该设备所属组织
  // 的有效授权 + 设备状态过滤。G5 设备隔离预演依赖此查询。

  async listAuthorizedPluginsForDevice(deviceId: string): Promise<any[]> {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    const now = new Date();
    const licenses = await this.prisma.ecologyLicense.findMany({
      where: { organizationId: device.organizationId, status: 'ACTIVE', expireAt: { gt: now } },
      include: { plugin: { select: { pluginId: true, name: true, type: true, description: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return licenses.map((l) => ({
      pluginId: l.plugin.pluginId,
      name: l.plugin.name,
      type: l.plugin.type,
      licenseId: l.id,
      licenseStatus: l.status,
      licenseType: l.licenseType,
      expireAt: l.expireAt,
      allowed: true,
      deviceStatus: device.status,
    }));
  }

  // ── 内部 ────────────────────────────────────────────────────

  /** 为设备本地应用补充应用身份（按 applicationId 批量查询 ecology_applications） */
  private async enrichLocalApps(localApps: any[]): Promise<any[]> {
    if (!localApps?.length) return [];
    const appIds = [...new Set(localApps.map((a) => a.applicationId))];
    const apps = await this.prisma.ecologyApplication.findMany({
      where: { id: { in: appIds } },
      select: { id: true, slug: true, name: true, category: true },
    });
    const byId = new Map(apps.map((a) => [a.id, a]));
    return localApps.map((a) => ({ ...a, application: byId.get(a.applicationId) ?? null }));
  }

  private toPublicDevice(d: any) {
    return {
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      os: d.os,
      status: d.status,
      lastHeartbeat: d.lastHeartbeat,
      createdAt: d.createdAt,
      localApps: d.localApps
        ? d.localApps.map((a: any) => ({
            applicationId: a.applicationId,
            slug: a.application?.slug ?? undefined,
            name: a.application?.name ?? undefined,
            category: a.application?.category ?? undefined,
            version: a.version,
            status: a.status,
            installedAt: a.installedAt,
          }))
        : undefined,
    };
  }

  private toPublicLocalApp(a: any) {
    return {
      applicationId: a.applicationId,
      version: a.version,
      installPath: a.installPath,
      status: a.status,
      installedAt: a.installedAt,
    };
  }
}
