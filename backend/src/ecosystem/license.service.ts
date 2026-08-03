/**
 * SPRINT-ECO-04 — License & Entitlement Boundary Service
 * 生态商业授权：只登记授权 / 只校验不执行 / 全事件审计
 *
 * 状态机（掌柜冻结）：
 *   subscribe → ACTIVE
 *   ACTIVE ──renew──→ ACTIVE
 *   ACTIVE ──expire──→ EXPIRED
 *   ACTIVE ──suspend──→ SUSPENDED
 *   SUSPENDED ──restore──→ ACTIVE
 *   EXPIRED ──renew──→ ACTIVE
 *
 * 纪律：不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes
 * 设计：License Check 为平台无关 HTTP 语义（支持未来 Kunlun Media.exe → KAOR → License Check → Plugin Load）
 */
import type { PrismaClient } from '@prisma/client';

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
export type LicenseEventType = 'INSTALL' | 'ACTIVATE' | 'RENEW' | 'EXPIRE' | 'SUSPEND' | 'RESTORE';

export class LicenseServiceError extends Error {
  constructor(message: string, public code: string = 'LICENSE_ERROR') {
    super(message);
  }
}

export interface GrantLicenseParams {
  organizationId: string;
  pluginId: string;
  pluginVersion?: string;
  licenseType?: 'trial' | 'subscription' | 'lifetime';
  durationDays?: number; // 默认 365（lifetime 可传 null）
  expireAt?: Date;
  sourceSubscriptionId?: string;
  machineId?: string;
  entitlements?: Record<string, unknown>;
}

export interface LicenseCheckParams {
  organizationId: string;
  pluginId: string;
  source?: 'kaor' | 'local_app';
  machineId?: string;
}

export interface LicenseCheckResult {
  allowed: boolean;
  reason: string; // OK | NO_LICENSE | EXPIRED | SUSPENDED | PLUGIN_NOT_FOUND
  license: {
    licenseId: string;
    status: LicenseStatus;
    pluginVersion: string;
    startAt: Date;
    expireAt: Date;
    licenseType: string;
  } | null;
}

export class LicenseService {
  constructor(private prisma: PrismaClient) {}

  // ── 状态流转 ────────────────────────────────────────────────

  /** subscribe：首次授权（幂等——已有许可返回现有，不覆盖） */
  async grantLicense(params: GrantLicenseParams) {
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId: params.pluginId } });
    if (!plugin) {
      throw new LicenseServiceError(`插件不存在: ${params.pluginId}`, 'PLUGIN_NOT_FOUND');
    }
    const existing = await this.prisma.ecologyLicense.findUnique({
      where: { organizationId_pluginId: { organizationId: params.organizationId, pluginId: plugin.id } },
    });
    if (existing) {
      return { license: existing, idempotent: true };
    }
    const now = new Date();
    const expireAt = params.expireAt
      ?? (params.licenseType === 'lifetime' ? new Date('2099-12-31T23:59:59Z') : new Date(now.getTime() + (params.durationDays ?? 365) * 86400000));
    // 版本解析：未显式指定时取插件最新 published 版本
    let resolvedVersion = params.pluginVersion;
    if (!resolvedVersion) {
      const latest = await this.prisma.ecologyPluginVersion.findFirst({
        where: { pluginId: plugin.id, status: 'published' },
        orderBy: { createdAt: 'desc' },
      });
      resolvedVersion = latest?.version ?? '1.0.0';
    }
    const license = await this.prisma.ecologyLicense.create({
      data: {
        organizationId: params.organizationId,
        pluginId: plugin.id,
        pluginVersion: resolvedVersion,
        status: 'ACTIVE',
        licenseType: params.licenseType ?? 'subscription',
        startAt: now,
        expireAt,
        sourceSubscriptionId: params.sourceSubscriptionId,
        machineId: params.machineId,
        entitlements: (params.entitlements ?? {}) as any,
      },
    });
    await this.recordEvent(license.id, 'INSTALL', { organizationId: params.organizationId, pluginId: params.pluginId });
    await this.recordEvent(license.id, 'ACTIVATE', { startAt: now.toISOString(), expireAt: expireAt.toISOString() });
    return { license, idempotent: false };
  }

  /** renew：ACTIVE/EXPIRED → ACTIVE（SUSPENDED 必须先 restore） */
  async renewLicense(licenseId: string, durationDays: number = 365, actor?: string) {
    const license = await this.getLicenseOrThrow(licenseId);
    if (license.status === 'SUSPENDED') {
      throw new LicenseServiceError('SUSPENDED 许可不可续期，请先 restore', 'INVALID_STATUS');
    }
    const newExpire = new Date(Math.max(Date.now(), license.expireAt.getTime()) + durationDays * 86400000);
    const updated = await this.prisma.ecologyLicense.update({
      where: { id: licenseId },
      data: { status: 'ACTIVE', expireAt: newExpire },
    });
    await this.recordEvent(licenseId, 'RENEW', { from: license.status, oldExpireAt: license.expireAt.toISOString(), newExpireAt: newExpire.toISOString(), actor });
    return updated;
  }

  /** expire：ACTIVE/SUSPENDED → EXPIRED（系统任务或显式） */
  async expireLicense(licenseId: string, reason?: string, actor?: string) {
    const license = await this.getLicenseOrThrow(licenseId);
    if (license.status === 'EXPIRED') return license;
    const updated = await this.prisma.ecologyLicense.update({
      where: { id: licenseId },
      data: { status: 'EXPIRED' },
    });
    await this.recordEvent(licenseId, 'EXPIRE', { from: license.status, reason, actor });
    return updated;
  }

  /** suspend：ACTIVE/EXPIRED → SUSPENDED */
  async suspendLicense(licenseId: string, reason?: string, actor?: string) {
    const license = await this.getLicenseOrThrow(licenseId);
    if (license.status === 'SUSPENDED') return license;
    const updated = await this.prisma.ecologyLicense.update({
      where: { id: licenseId },
      data: { status: 'SUSPENDED' },
    });
    await this.recordEvent(licenseId, 'SUSPEND', { from: license.status, reason, actor });
    return updated;
  }

  /** restore：SUSPENDED → ACTIVE */
  async restoreLicense(licenseId: string, actor?: string) {
    const license = await this.getLicenseOrThrow(licenseId);
    if (license.status !== 'SUSPENDED') {
      throw new LicenseServiceError(`仅 SUSPENDED 可 restore（当前 ${license.status}）`, 'INVALID_STATUS');
    }
    const updated = await this.prisma.ecologyLicense.update({
      where: { id: licenseId },
      data: { status: 'ACTIVE' },
    });
    await this.recordEvent(licenseId, 'RESTORE', { actor });
    return updated;
  }

  /** 批量到期流转：ACTIVE/SUSPENDED 且 expireAt < now → EXPIRED（幂等，供启动/定时任务） */
  async expireDueLicenses(): Promise<number> {
    const due = await this.prisma.ecologyLicense.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED'] }, expireAt: { lt: new Date() } },
    });
    for (const l of due) {
      await this.prisma.ecologyLicense.update({ where: { id: l.id }, data: { status: 'EXPIRED' } });
      await this.recordEvent(l.id, 'EXPIRE', { from: l.status, reason: 'AUTO_EXPIRE' });
    }
    return due.length;
  }

  // ── 校验（G7 核心：插件过期 → 应用继续打开，插件不可运行）──

  async checkLicense(params: LicenseCheckParams): Promise<LicenseCheckResult> {
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { pluginId: params.pluginId } });
    if (!plugin) {
      await this.logCheck(params, null, 'denied', 'PLUGIN_NOT_FOUND');
      return { allowed: false, reason: 'PLUGIN_NOT_FOUND', license: null };
    }
    const license = await this.prisma.ecologyLicense.findUnique({
      where: { organizationId_pluginId: { organizationId: params.organizationId, pluginId: plugin.id } },
    });
    if (!license) {
      await this.logCheck(params, null, 'denied', 'NO_LICENSE');
      return { allowed: false, reason: 'NO_LICENSE', license: null };
    }
    // 惰性到期流转
    if (license.status === 'ACTIVE' && license.expireAt <= new Date()) {
      await this.expireLicense(license.id, 'EXPIRED_ON_CHECK');
      const expired = await this.getLicenseOrThrow(license.id);
      await this.logCheck(params, expired, 'denied', 'EXPIRED');
      return { allowed: false, reason: 'EXPIRED', license: this.toCheckLicense(expired) };
    }
    if (license.status === 'EXPIRED') {
      await this.logCheck(params, license, 'denied', 'EXPIRED');
      return { allowed: false, reason: 'EXPIRED', license: this.toCheckLicense(license) };
    }
    if (license.status === 'SUSPENDED') {
      await this.logCheck(params, license, 'denied', 'SUSPENDED');
      return { allowed: false, reason: 'SUSPENDED', license: this.toCheckLicense(license) };
    }
    await this.logCheck(params, license, 'allowed', 'OK');
    return { allowed: true, reason: 'OK', license: this.toCheckLicense(license) };
  }

  /** 批量校验（KAOR 插件加载前调用：一次校验多个插件） */
  async checkLicenses(params: LicenseCheckParams[]): Promise<LicenseCheckResult[]> {
    return Promise.all(params.map(p => this.checkLicense(p)));
  }

  // ── 查询 ────────────────────────────────────────────────────

  async getLicense(licenseId: string) {
    return this.prisma.ecologyLicense.findUnique({
      where: { id: licenseId },
      include: { plugin: { select: { pluginId: true, name: true, type: true } } },
    });
  }

  async listLicensesByOrganization(organizationId: string) {
    return this.prisma.ecologyLicense.findMany({
      where: { organizationId },
      include: { plugin: { select: { pluginId: true, name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listEvents(licenseId: string, limit: number = 50) {
    return this.prisma.ecologyLicenseEvent.findMany({
      where: { licenseId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async listCheckLogs(organizationId: string, limit: number = 50) {
    return this.prisma.ecologyLicenseCheckLog.findMany({
      where: { organizationId },
      orderBy: { checkedAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  // ── 内部 ────────────────────────────────────────────────────

  private async getLicenseOrThrow(licenseId: string) {
    const license = await this.prisma.ecologyLicense.findUnique({ where: { id: licenseId } });
    if (!license) throw new LicenseServiceError(`许可不存在: ${licenseId}`, 'LICENSE_NOT_FOUND');
    return license;
  }

  private async recordEvent(licenseId: string, eventType: LicenseEventType, detail: Record<string, unknown>) {
    await this.prisma.ecologyLicenseEvent.create({
      data: { licenseId, eventType, detail: detail as any },
    });
  }

  private async logCheck(params: LicenseCheckParams, license: any, result: 'allowed' | 'denied', reason: string) {
    await this.prisma.ecologyLicenseCheckLog.create({
      data: {
        organizationId: params.organizationId,
        pluginId: params.pluginId,
        licenseId: license?.id ?? null,
        result,
        reason,
        source: params.source ?? 'kaor',
        machineId: params.machineId,
      },
    });
  }

  private toCheckLicense(l: any) {
    return {
      licenseId: l.id,
      status: l.status as LicenseStatus,
      pluginVersion: l.pluginVersion,
      startAt: l.startAt,
      expireAt: l.expireAt,
      licenseType: l.licenseType,
    };
  }
}
