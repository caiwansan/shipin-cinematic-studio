/**
 * SPRINT-ECO-05 — Developer Center Foundation Service
 * 开发者身份 + 插件发布基础（只登记不执行 / 只留痕不审核 UI）
 *
 * 链路：Developer → Plugin Author → Plugin Version → Review Status → Marketplace Ready
 * 状态机（掌柜冻结）：
 *   开发者：CREATED → VERIFIED；任意 → SUSPENDED
 *   发布申请：DRAFT → SUBMITTED → APPROVED / REJECTED
 *
 * 三个核心边界（掌柜指定 Reality Gate）：
 *   G1 Author Ownership — 开发者 A 不能修改开发者 B 的插件（author = developerId 强校验）
 *   G2 Permission Intersection — manifest.permissions ∩ platform capabilities，越界拒绝发布
 *   G3 Version Ownership — (plugin-id + version + author) 唯一，防止恶意覆盖
 *
 * 纪律：不做开发者商城 / 不做收益提现 / 不做推广系统 / 不做审核后台 UI
 * 设计：author 关联为 service 层语义（ecology_plugins.author = developer.developerId）
 */
import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { KNOWN_PERMISSIONS } from './plugin-manifest.schema.js';

export type DeveloperStatus = 'CREATED' | 'VERIFIED' | 'SUSPENDED';
export type PublishRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type AgreementType = 'developer_terms' | 'revenue_share' | 'ip_ownership' | 'plugin_liability';

export class DeveloperServiceError extends Error {
  constructor(message: string, public code: string = 'DEVELOPER_ERROR') {
    super(message);
  }
}

export class DeveloperService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 开发者允许权限集（G2 第二层：Developer Allowed Permissions，按身份状态分级）
   *   VERIFIED → 全量平台白名单（KNOWN_PERMISSIONS，ECO-02 注释：未来扩展只改这里）
   *   CREATED  → 基础内容/数据权限（新开发者最小集）
   *   SUSPENDED→ 空（暂停即无发布能力）
   */
  static developerAllowedPermissions(status: string): string[] {
    if (status === 'VERIFIED') return [...KNOWN_PERMISSIONS];
    if (status === 'CREATED') return ['content', 'analytics'];
    return [];
  }

  // ── 开发者身份 ──────────────────────────────────────────────

  /** register：创建开发者（幂等——同一 userId 返回现有） */
  async registerDeveloper(params: { userId: string; organizationId: string; developerName: string }) {
    const existing = await this.prisma.ecologyDeveloper.findUnique({ where: { userId: params.userId } });
    if (existing) return { developer: existing, idempotent: true };

    const developerId = `dev-${randomBytes(5).toString('hex')}`; // 公开 ID，插件 author 引用
    const developer = await this.prisma.ecologyDeveloper.create({
      data: {
        developerId,
        userId: params.userId,
        organizationId: params.organizationId,
        developerName: params.developerName,
        status: 'CREATED',
      },
    });
    return { developer, idempotent: false };
  }

  /** verify：CREATED → VERIFIED（登记操作，不做人工审核 UI） */
  async verifyDeveloper(developerId: string) {
    const dev = await this.getDeveloperByIdOrThrow(developerId);
    if (dev.status === 'VERIFIED') return dev;
    return this.prisma.ecologyDeveloper.update({
      where: { id: dev.id },
      data: { status: 'VERIFIED' },
    });
  }

  /** suspend：任意状态 → SUSPENDED */
  async suspendDeveloper(developerId: string) {
    const dev = await this.getDeveloperByIdOrThrow(developerId);
    if (dev.status === 'SUSPENDED') return dev;
    return this.prisma.ecologyDeveloper.update({
      where: { id: dev.id },
      data: { status: 'SUSPENDED' },
    });
  }

  /** 按公开 developerId 查找 */
  async getDeveloper(developerId: string) {
    return this.prisma.ecologyDeveloper.findUnique({ where: { developerId } });
  }

  async getDeveloperByUserId(userId: string) {
    return this.prisma.ecologyDeveloper.findUnique({ where: { userId } });
  }

  async listDevelopers(organizationId: string) {
    return this.prisma.ecologyDeveloper.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  private async getDeveloperByIdOrThrow(id: string) {
    const dev = await this.prisma.ecologyDeveloper.findUnique({ where: { id } });
    if (!dev) throw new DeveloperServiceError(`开发者不存在: ${id}`, 'DEVELOPER_NOT_FOUND');
    return dev;
  }

  // ── G1: Author Ownership（开发者 A 不能修改开发者 B 的插件）──

  /**
   * 校验开发者是否拥有插件（ecology_plugins.author === developer.developerId）
   * 所有开发者侧操作（建发布申请/提交/更新）必须通过此校验
   */
  async assertPluginOwnership(developerId: string, pluginEcologyId: string) {
    const dev = await this.getDeveloperByIdOrThrow(developerId);
    const plugin = await this.prisma.ecologyPlugin.findUnique({ where: { id: pluginEcologyId } });
    if (!plugin) throw new DeveloperServiceError(`插件不存在: ${pluginEcologyId}`, 'PLUGIN_NOT_FOUND');
    if (dev.status === 'SUSPENDED') {
      throw new DeveloperServiceError('开发者已被暂停，无法操作插件', 'DEVELOPER_SUSPENDED');
    }
    if (plugin.author !== dev.developerId) {
      throw new DeveloperServiceError(
        `无权操作: 插件作者 ${plugin.author} ≠ 开发者 ${dev.developerId}（Author Ownership）`,
        'AUTHOR_MISMATCH',
      );
    }
    return { developer: dev, plugin };
  }

  // ── 发布申请 ────────────────────────────────────────────────

  /**
   * createPublishRequest：DRAFT（G1 作者归属 + G3 版本归属校验）
   * G3: version 必须属于该插件（防跨插件挂版本）；(pluginId, versionId) 唯一防重复覆盖
   */
  async createPublishRequest(params: { developerId: string; pluginId: string; versionId: string }) {
    const { developer, plugin } = await this.assertPluginOwnership(params.developerId, params.pluginId);
    const version = await this.prisma.ecologyPluginVersion.findUnique({ where: { id: params.versionId } });
    if (!version) throw new DeveloperServiceError(`插件版本不存在: ${params.versionId}`, 'VERSION_NOT_FOUND');
    // G3: 版本必须属于该插件（(plugin-id + version) 归属校验，防恶意挂载）
    if (version.pluginId !== plugin.id) {
      throw new DeveloperServiceError('版本不属于该插件（Version Ownership）', 'VERSION_MISMATCH');
    }
    const existing = await this.prisma.ecologyPluginPublishRequest.findUnique({
      where: { pluginId_versionId: { pluginId: plugin.id, versionId: version.id } },
    });
    if (existing) {
      // 幂等：同一开发者重复创建返回现有；他人创建的 → G1 已挡（plugin 归属不同）
      return { request: existing, idempotent: true };
    }
    const request = await this.prisma.ecologyPluginPublishRequest.create({
      data: {
        pluginId: plugin.id,
        versionId: version.id,
        developerId: developer.id,
        status: 'DRAFT',
      },
    });
    return { request, idempotent: false };
  }

  /**
   * submitPublishRequest：DRAFT → SUBMITTED
   * 提交时执行 G2 Permission Intersection（越界能力拒绝提交）
   */
  async submitPublishRequest(requestId: string, actorDeveloperId: string) {
    const request = await this.getRequestOrThrow(requestId);
    const dev = await this.getDeveloperByIdOrThrow(actorDeveloperId);
    if (request.developerId !== dev.id) {
      throw new DeveloperServiceError('无权提交他人发布申请（Author Ownership）', 'AUTHOR_MISMATCH');
    }
    if (request.status !== 'DRAFT') {
      throw new DeveloperServiceError(`仅 DRAFT 可提交（当前 ${request.status}）`, 'INVALID_STATUS');
    }
    // G2: 提交前权限交集校验（三层：声明 ∩ 开发者允许 ∩ 平台白名单）
    const perm = await this.checkPermissionIntersection(request.pluginId, request.versionId, dev.id);
    if (!perm.allowed) {
      throw new DeveloperServiceError(`权限交集校验不通过: ${perm.reason}`, 'PERMISSION_OUT_OF_SCOPE');
    }
    return this.prisma.ecologyPluginPublishRequest.update({
      where: { id: requestId },
      data: { status: 'SUBMITTED' },
    });
  }

  /**
   * approvePublishRequest：SUBMITTED → APPROVED（登记：Marketplace Ready）
   * 自动将插件标记 PUBLISHED（只登记状态，不执行任何代码/不生成商城 UI）
   */
  async approvePublishRequest(requestId: string, reviewer?: string, note?: string) {
    const request = await this.getRequestOrThrow(requestId);
    if (request.status !== 'SUBMITTED') {
      throw new DeveloperServiceError(`仅 SUBMITTED 可审批（当前 ${request.status}）`, 'INVALID_STATUS');
    }
    await this.prisma.ecologyPluginPublishRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', reviewedBy: reviewer, reviewNote: note, reviewedAt: new Date() },
    });
    await this.prisma.ecologyPlugin.update({
      where: { id: request.pluginId },
      data: { status: 'PUBLISHED' },
    });
    return this.getRequestOrThrow(requestId);
  }

  /** rejectPublishRequest：SUBMITTED → REJECTED（登记意见） */
  async rejectPublishRequest(requestId: string, reviewer?: string, note?: string) {
    const request = await this.getRequestOrThrow(requestId);
    if (request.status !== 'SUBMITTED') {
      throw new DeveloperServiceError(`仅 SUBMITTED 可驳回（当前 ${request.status}）`, 'INVALID_STATUS');
    }
    return this.prisma.ecologyPluginPublishRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedBy: reviewer, reviewNote: note ?? null, reviewedAt: new Date() },
    });
  }

  async listPublishRequests(filter: { developerId?: string; status?: string }) {
    return this.prisma.ecologyPluginPublishRequest.findMany({
      where: { developerId: filter.developerId, status: filter.status },
      include: { plugin: true, version: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getRequestOrThrow(id: string) {
    const req = await this.prisma.ecologyPluginPublishRequest.findUnique({ where: { id } });
    if (!req) throw new DeveloperServiceError(`发布申请不存在: ${id}`, 'REQUEST_NOT_FOUND');
    return req;
  }

  // ── G2: Permission Intersection（声明 ∩ 开发者允许 ∩ 平台能力）──

  /**
   * 权限交集校验（三层，掌柜 G2）：
   *   manifest.permissions（插件声明，ECO-02 枚举校验已过）
   *   ∩ developerAllowed（DeveloperService.developerAllowedPermissions：VERIFIED/CREATED/SUSPENDED 分级）
   *   ∩ platformAllowed（KNOWN_PERMISSIONS：生态平台对插件权限白名单，SSOT）
   * 交集为空 → 拒绝发布；声明为空 = 零权限插件（合法）
   * developerId 可选：发布提交时必传（身份分级）；预览 API 不传则仅校验平台白名单层
   */
  async checkPermissionIntersection(pluginEcologyId: string, versionId: string, developerId?: string) {
    const version = await this.prisma.ecologyPluginVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new DeveloperServiceError(`插件版本不存在: ${versionId}`, 'VERSION_NOT_FOUND');
    if (version.pluginId !== pluginEcologyId) {
      throw new DeveloperServiceError('版本不属于该插件（Version Ownership）', 'VERSION_MISMATCH');
    }
    const manifest = (version.manifest ?? {}) as any;
    const manifestPermissions: string[] = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    // 平台能力层：KNOWN_PERMISSIONS（ECO-02 白名单，扩展只改一处）
    const platformAllowed = [...KNOWN_PERMISSIONS];
    // 开发者允许层：身份状态分级
    let developerAllowed: string[] = platformAllowed;
    let developerStatus = 'N/A';
    if (developerId) {
      const dev = await this.getDeveloperByIdOrThrow(developerId);
      developerStatus = dev.status;
      developerAllowed = DeveloperService.developerAllowedPermissions(dev.status);
    }

    if (manifestPermissions.length === 0) {
      return {
        allowed: true,
        reason: 'OK_ZERO_PERMISSIONS',
        manifestPermissions: [] as string[],
        developerAllowed,
        developerStatus,
        platformAllowed,
        intersection: [] as string[],
        note: '零权限插件：无能力声明，视为平台全量许可',
      };
    }
    const denied = manifestPermissions.filter(p => !developerAllowed.includes(p) || !platformAllowed.includes(p));
    if (denied.length > 0) {
      return {
        allowed: false,
        reason: `PERMISSION_OUT_OF_SCOPE: ${denied.join(',')} 超出开发者允许/平台白名单`, 
        manifestPermissions,
        developerAllowed,
        developerStatus,
        platformAllowed,
        intersection: manifestPermissions.filter(p => developerAllowed.includes(p) && platformAllowed.includes(p)),
        note: '声明能力未获开发者允许或平台背书，禁止发布',
      };
    }
    return {
      allowed: true,
      reason: 'OK',
      manifestPermissions,
      developerAllowed,
      developerStatus,
      platformAllowed,
      intersection: manifestPermissions.filter(p => developerAllowed.includes(p) && platformAllowed.includes(p)),
      note: '声明能力 ⊆ 开发者允许 ∩ 平台白名单，允许发布',
    };
  }

  // ── 开发者协议（留痕：分成 / IP / 插件责任）──

  /** signAgreement：协议签署记录（幂等——同类型同版本已签返回现有） */
  async signAgreement(params: { developerId: string; agreementType: AgreementType; version: string; content?: string }) {
    const dev = await this.getDeveloperByIdOrThrow(params.developerId);
    const existing = await this.prisma.ecologyDeveloperAgreement.findUnique({
      where: {
        developerId_agreementType_version: {
          developerId: dev.id,
          agreementType: params.agreementType,
          version: params.version,
        },
      },
    });
    if (existing) return { agreement: existing, idempotent: true };
    const agreement = await this.prisma.ecologyDeveloperAgreement.create({
      data: {
        developerId: dev.id,
        agreementType: params.agreementType,
        version: params.version,
        content: params.content,
        status: 'SIGNED',
      },
    });
    return { agreement, idempotent: false };
  }

  async listAgreements(developerId: string) {
    return this.prisma.ecologyDeveloperAgreement.findMany({ where: { developerId }, orderBy: { signedAt: 'desc' } });
  }
}
