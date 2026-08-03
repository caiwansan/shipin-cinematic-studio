/**
 * SPRINT-ECO-01 — Ecology Application Routes
 * 生态应用中心 API：只读列出应用身份 + 组织安装状态。
 * 纪律：只挂载身份，不碰工作台业务，不做商城。
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../utils/index.js';
import {
  listApplications,
  getApplicationBySlug,
  installApplicationForOrg,
  listOrgInstallations,
  seedBuiltinApplications,
} from '../ecosystem/application-registry.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

async function resolveOrgId(request: any): Promise<string> {
  const user = request.user as any;
  const userId = user?.id;
  if (!userId) return '';
  if (user.organizationId) return user.organizationId;
  if (user?.tenantId && user.tenantId !== userId) return user.tenantId;
  try {
    const orgId = await getOrganizationIdForUser(userId);
    return orgId || '';
  } catch {
    return userId;
  }
}

export async function registerEcologyApplicationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/ecosystem/applications — 应用目录（只读）
   * 返回 9 内置应用身份 + 当前组织安装状态
   */
  app.get('/applications', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request);
      const apps = await listApplications();
      const installs = organizationId ? await listOrgInstallations(organizationId) : [];
      const installMap = new Map(installs.map((i) => [i.slug, i]));

      return reply.send({
        code: 0,
        data: {
          applications: apps.map((a) => ({
            ...a,
            installed: installMap.get(a.slug) ?? null,
          })),
          total: apps.length,
        },
      });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `应用目录查询失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/applications/:slug — 应用详情（含版本历史）
   */
  app.get('/applications/:slug', async (request: any, reply: any) => {
    try {
      const { slug } = request.params as { slug: string };
      const app = await getApplicationBySlug(slug);
      if (!app) return reply.code(404).send({ code: 404, message: '应用不存在' });
      return reply.send({ code: 0, data: app });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `应用详情查询失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/applications/:slug/install — 组织安装（幂等）
   * 仅记录安装关系，不产生支付、不修改工作台。
   */
  app.post('/applications/:slug/install', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request);
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法安装应用' });
      }
      const { slug } = request.params as { slug: string };
      const result = await installApplicationForOrg(organizationId, slug);
      if (!result.ok) {
        return reply.code(404).send({ code: 404, message: '应用不存在' });
      }
      return reply.send({ code: 0, data: { reused: result.reused, install: result.install } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `应用安装失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/health — 生态层健康检查（含内置应用注册数）
   */
  app.get('/health', async (_request: any, reply: any) => {
    try {
      const count = await prisma.ecologyApplication.count();
      const versionCount = await prisma.ecologyApplicationVersion.count();
      return reply.send({
        code: 0,
        data: {
          status: 'ok',
          applications: count,
          versions: versionCount,
          layer: 'application-adapter',
          sprint: 'ECO-01',
        },
      });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `生态健康检查失败: ${e.message}` });
    }
  });
}

/** 启动时幂等注册内置应用（ECO-01 seed） */
export async function ensureEcologySeed() {
  const result = await seedBuiltinApplications();
  return result;
}
