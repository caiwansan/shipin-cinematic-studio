/**
 * SPRINT-ECO-02 — Ecology Plugin Routes
 * 插件身份系统 API：只登记身份 / 只读目录 / 登记安装，不执行任何插件代码。
 * 纪律：不执行插件 / 不运行第三方代码 / 不接入支付 / 不做商城 UI / 不做开发者后台。
 */
import type { FastifyInstance } from 'fastify';
import {
  registerPlugin,
  listPlugins,
  getPlugin,
  installPlugin,
  uninstallPlugin,
  PluginRegistryError,
} from '../ecosystem/plugin-registry.service.js';
import { validatePluginManifest } from '../ecosystem/plugin-manifest.schema.js';
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

export async function registerEcologyPluginRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/ecosystem/plugins — 插件目录（只读）
   * 返回已登记插件身份 + 当前组织安装状态
   */
  app.get('/plugins', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request);
      const plugins = await listPlugins(organizationId || undefined);
      return reply.send({ code: 0, data: { plugins, total: plugins.length } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `插件目录查询失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/plugins/:pluginId — 插件详情（含版本历史）
   */
  app.get('/plugins/:pluginId', async (request: any, reply: any) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const organizationId = await resolveOrgId(request);
      const plugin = await getPlugin(pluginId, organizationId || undefined);
      if (!plugin) return reply.code(404).send({ code: 404, message: '插件不存在' });
      return reply.send({ code: 0, data: plugin });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `插件详情查询失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/plugins/validate — manifest 校验（只验证不执行）
   * 供调试/未来开发者使用；返回 errors 列表，非法不落库。
   */
  app.post('/plugins/validate', async (request: any, reply: any) => {
    try {
      const { manifest } = (request.body ?? {}) as { manifest?: unknown };
      const result = validatePluginManifest(manifest);
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `manifest 校验失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/plugins/register — 注册插件身份（幂等）
   * 只登记身份 + 版本快照，绝不执行插件代码。
   */
  app.post('/plugins/register', async (request: any, reply: any) => {
    try {
      const { manifest } = (request.body ?? {}) as { manifest?: unknown };
      const result = await registerPlugin(manifest);
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      if (e instanceof PluginRegistryError) {
        const status = e.code === 'INVALID_MANIFEST' ? 400 : e.code === 'PLUGIN_ID_CONFLICT' ? 409 : 404;
        return reply.code(status).send({ code: status, message: e.message, errorCode: e.code });
      }
      return reply.code(500).send({ code: 500, message: `插件注册失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/plugins/:pluginId/install — 登记安装（幂等）
   * 只写安装记录，不执行插件 / 不产生支付。
   */
  app.post('/plugins/:pluginId/install', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request);
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法安装插件' });
      }
      const { pluginId } = request.params as { pluginId: string };
      const result = await installPlugin(organizationId, pluginId);
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      if (e instanceof PluginRegistryError) {
        return reply.code(404).send({ code: 404, message: e.message, errorCode: e.code });
      }
      return reply.code(500).send({ code: 500, message: `插件安装失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/plugins/:pluginId/uninstall — 登记卸载
   * 只标记状态，不执行任何代码。
   */
  app.post('/plugins/:pluginId/uninstall', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request);
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法卸载插件' });
      }
      const { pluginId } = request.params as { pluginId: string };
      const result = await uninstallPlugin(organizationId, pluginId);
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      if (e instanceof PluginRegistryError) {
        return reply.code(404).send({ code: 404, message: e.message, errorCode: e.code });
      }
      return reply.code(500).send({ code: 500, message: `插件卸载失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/plugins-health — 插件层健康检查
   */
  app.get('/plugins-health', async (_request: any, reply: any) => {
    try {
      const { prisma } = await import('../utils/index.js');
      const [plugins, versions, installs] = await Promise.all([
        prisma.ecologyPlugin.count(),
        prisma.ecologyPluginVersion.count(),
        prisma.ecologyPluginInstall.count(),
      ]);
      return reply.send({
        code: 0,
        data: { status: 'ok', plugins, versions, installs, layer: 'plugin-manifest', sprint: 'ECO-02' },
      });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `插件层健康检查失败: ${e.message}` });
    }
  });
}
