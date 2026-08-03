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
      include: { plugin: { select: { id: true, pluginId: true, name: true, type: true, description: true, manifest: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // 实时 join 本地运行时状态（ECO-11.3：G7 双端一致性的 Desktop 侧来源）
    const runtimes = await this.prisma.ecologyLocalPluginRuntime.findMany({
      where: { deviceId: device.id },
      select: { pluginId: true, status: true, version: true, lastHeartbeat: true },
    });
    const runtimeByPlugin = new Map(runtimes.map((r: any) => [r.pluginId, r]));
    const kaorRuntime = await this.prisma.ecologyRuntime.findUnique({ where: { runtimeId: 'kaor' } }).catch(() => null);
    const bindings = kaorRuntime
      ? await this.prisma.ecologyPluginRuntimeBinding.findMany({
          where: { runtimeId: kaorRuntime.id },
          select: { pluginId: true },
        })
      : [];
    const boundPluginIds = new Set(bindings.map((b: any) => b.pluginId));
    return licenses.map((l) => {
      const manifest = (l.plugin.manifest ?? {}) as any;
      const runtime = runtimeByPlugin.get(l.plugin.id);
      return {
        pluginId: l.plugin.pluginId,
        name: l.plugin.name,
        type: l.plugin.type,
        licenseId: l.id,
        licenseStatus: l.status,
        licenseType: l.licenseType,
        expireAt: l.expireAt,
        allowed: true,
        deviceStatus: device.status,
        // ECO-11.3：桌面 loader 需要的能力信息（白名单 + KAOR 绑定 + 本地运行时状态）
        runtimeLocal: manifest?.runtime?.local === true,
        kaorBound: boundPluginIds.has(l.plugin.id),
        runtimeStatus: runtime?.status ?? null,
        runtimeVersion: runtime?.version ?? null,
        lastHeartbeat: runtime?.lastHeartbeat ?? null,
      };
    });
  }

  // ── ECO-11.3 Local Plugin Runtime（设备 ↔ 插件运行时实例）──
  // 掌柜冻结（2026-08-04）：
  //   - 本地 = 入口 + 状态管理；云端 = AI 执行真相（本地零代码执行）
  //   - 授权判定唯一实现 = checkPluginLaunch（launch-check 与 start 共用，D4）
  //   - runtime 表只存生命周期（安装/版本/运行状态/心跳），不存授权结论（D1）

  /** 授权判定唯一实现：设备 ACTIVE + License ACTIVE（实时 join ecology_licenses） */
  async checkPluginLaunch(
    deviceId: string,
    pluginId: string,
  ): Promise<{
    allowed: boolean;
    reason: string;
    deviceStatus: string | null;
    licenseId?: string;
    expireAt?: Date | null;
    device?: any;
    plugin?: any;
    license?: any;
  }> {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId } });
    if (!device) return { allowed: false, reason: 'DEVICE_NOT_FOUND', deviceStatus: null };
    if (device.status !== 'ACTIVE') {
      return { allowed: false, reason: `DEVICE_${device.status}`, deviceStatus: device.status, device };
    }
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId } });
    if (!plugin) return { allowed: false, reason: 'PLUGIN_NOT_FOUND', deviceStatus: device.status, device };
    const license = await this.prisma.ecologyLicense.findUnique({
      where: { organizationId_pluginId: { organizationId: device.organizationId, pluginId: plugin.id } },
    });
    if (!license) return { allowed: false, reason: 'NO_LICENSE', deviceStatus: device.status, device, plugin };
    if (license.status === 'EXPIRED' || license.expireAt <= new Date()) {
      return { allowed: false, reason: 'EXPIRED', deviceStatus: device.status, device, plugin, license };
    }
    if (license.status === 'SUSPENDED') {
      return { allowed: false, reason: 'SUSPENDED', deviceStatus: device.status, device, plugin, license };
    }
    return { allowed: true, reason: 'OK', deviceStatus: device.status, device, plugin, license, licenseId: license.id, expireAt: license.expireAt };
  }

  /**
   * 桌面插件启动（Task03 loader 流程）：
   * checkPluginLaunch（唯一授权判定）→ local 白名单（manifest.local）→ KAOR 绑定
   * → 审计 → upsert runtime 行（RUNNING + startedAt + lastHeartbeat）
   * 本地不执行任何插件代码；返回能力展示所需信息
   */
  async startPluginRuntime(params: { organizationId: string; deviceId: string; pluginId: string; version?: string }) {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId: params.deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.organizationId !== params.organizationId) {
      throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
    }
    const gate = await this.checkPluginLaunch(params.deviceId, params.pluginId);
    if (!gate.allowed || !gate.plugin || !gate.license) {
      // 门禁拒绝：记录审计（拒绝也是证据）
      await this.prisma.ecologyLicenseCheckLog.create({
        data: {
          organizationId: device.organizationId,
          pluginId: params.pluginId,
          licenseId: gate.license?.id ?? null,
          result: 'denied',
          reason: gate.reason,
          source: 'local_app',
          machineId: device.deviceId,
        },
      });
      return { allowed: false, reason: gate.reason, deviceStatus: device.status };
    }
    // local 白名单（ECO-11.3 Task02：runtime.local=true 才允许桌面入口）
    const manifest = (gate.plugin.manifest ?? {}) as any;
    if (manifest?.runtime?.local !== true) {
      return { allowed: false, reason: 'NOT_LOCAL_CAPABLE', deviceStatus: device.status };
    }
    // KAOR 能力检查（ECO-03：插件必须绑定 KAOR runtime 才具备云端 Agent 执行能力）
    const kaor = await this.prisma.ecologyRuntime.findUnique({ where: { runtimeId: 'kaor' } }).catch(() => null);
    const binding = kaor
      ? await this.prisma.ecologyPluginRuntimeBinding.findUnique({
          where: { pluginId_runtimeId: { pluginId: gate.plugin.id, runtimeId: kaor.id } },
        })
      : null;
    if (!binding) {
      return { allowed: false, reason: 'NO_KAOR_BINDING', deviceStatus: device.status };
    }
    // 审计：allowed
    await this.prisma.ecologyLicenseCheckLog.create({
      data: {
        organizationId: device.organizationId,
        pluginId: params.pluginId,
        licenseId: gate.license.id,
        result: 'allowed',
        reason: 'OK',
        source: 'local_app',
        machineId: device.deviceId,
      },
    });
    // upsert 运行时实例（每设备每插件单实例；重装/升级 = 更新 version）
    const now = new Date();
    const existing = await this.prisma.ecologyLocalPluginRuntime.findUnique({
      where: { deviceId_pluginId: { deviceId: device.id, pluginId: gate.plugin.id } },
    });
    const runtime = existing
      ? await this.prisma.ecologyLocalPluginRuntime.update({
          where: { id: existing.id },
          data: {
            status: 'RUNNING',
            version: params.version ?? existing.version,
            startedAt: now,
            lastHeartbeat: now,
            stoppedAt: null,
          },
        })
      : await this.prisma.ecologyLocalPluginRuntime.create({
          data: {
            organizationId: device.organizationId,
            deviceId: device.id,
            pluginId: gate.plugin.id,
            version: params.version ?? '1.0.0',
            status: 'RUNNING',
            startedAt: now,
            lastHeartbeat: now,
          },
        });
    return {
      allowed: true,
      reason: 'OK',
      deviceStatus: device.status,
      licenseId: gate.license.id,
      expireAt: gate.license.expireAt,
      runtime: this.toPublicPluginRuntime(runtime),
    };
  }

  /** 插件运行时心跳（设备凭据鉴权；吊销/禁用 → allowed:false 本地降级信号） */
  async heartbeatPluginRuntime(params: { deviceId: string; pluginId: string; token: string }) {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId: params.deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.deviceTokenHash !== DeviceService.hashToken(params.deviceId, params.token)) {
      throw new DeviceServiceError('设备凭据无效', 'DEVICE_TOKEN_INVALID');
    }
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId: params.pluginId } });
    if (!plugin) throw new DeviceServiceError('插件不存在', 'PLUGIN_NOT_FOUND');
    const runtime = await this.prisma.ecologyLocalPluginRuntime.findUnique({
      where: { deviceId_pluginId: { deviceId: device.id, pluginId: plugin.id } },
    });
    if (!runtime) throw new DeviceServiceError('插件运行时不存在（需先 start）', 'PLUGIN_RUNTIME_NOT_FOUND');
    const now = new Date();
    await this.prisma.ecologyLocalPluginRuntime.update({
      where: { id: runtime.id },
      data: { lastHeartbeat: now },
    });
    if (device.status !== 'ACTIVE') {
      return { status: device.status as DeviceStatus, allowed: false, pluginStatus: runtime.status };
    }
    return { status: 'ACTIVE', allowed: true, pluginStatus: runtime.status };
  }

  /** 停止插件运行（停用 → DISABLED + stoppedAt；不删行） */
  async stopPluginRuntime(params: { organizationId: string; deviceId: string; pluginId: string }) {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId: params.deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.organizationId !== params.organizationId) {
      throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
    }
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId: params.pluginId } });
    if (!plugin) throw new DeviceServiceError('插件不存在', 'PLUGIN_NOT_FOUND');
    const runtime = await this.prisma.ecologyLocalPluginRuntime.findUnique({
      where: { deviceId_pluginId: { deviceId: device.id, pluginId: plugin.id } },
    });
    if (!runtime) throw new DeviceServiceError('插件运行时不存在', 'PLUGIN_RUNTIME_NOT_FOUND');
    const updated = await this.prisma.ecologyLocalPluginRuntime.update({
      where: { id: runtime.id },
      data: { status: 'DISABLED', stoppedAt: new Date() },
    });
    return { runtime: this.toPublicPluginRuntime(updated) };
  }

  /** 卸载插件（UNINSTALLED + stoppedAt；不删行，保留审计轨迹） */
  async uninstallPluginRuntime(params: { organizationId: string; deviceId: string; pluginId: string }) {
    const device = await this.prisma.ecologyDevice.findUnique({ where: { deviceId: params.deviceId } });
    if (!device) throw new DeviceServiceError('设备不存在', 'DEVICE_NOT_FOUND');
    if (device.organizationId !== params.organizationId) {
      throw new DeviceServiceError('设备不属于当前组织', 'DEVICE_ORG_MISMATCH');
    }
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId: params.pluginId } });
    if (!plugin) throw new DeviceServiceError('插件不存在', 'PLUGIN_NOT_FOUND');
    const runtime = await this.prisma.ecologyLocalPluginRuntime.findUnique({
      where: { deviceId_pluginId: { deviceId: device.id, pluginId: plugin.id } },
    });
    if (!runtime) return { runtime: null, idempotent: true };
    const updated = await this.prisma.ecologyLocalPluginRuntime.update({
      where: { id: runtime.id },
      data: { status: 'UNINSTALLED', stoppedAt: new Date() },
    });
    return { runtime: this.toPublicPluginRuntime(updated), idempotent: false };
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

  private toPublicPluginRuntime(r: any) {
    return {
      deviceId: r.deviceId,
      pluginId: r.pluginId,
      version: r.version,
      status: r.status,
      installedAt: r.installedAt,
      startedAt: r.startedAt,
      lastHeartbeat: r.lastHeartbeat,
      stoppedAt: r.stoppedAt,
    };
  }
}
