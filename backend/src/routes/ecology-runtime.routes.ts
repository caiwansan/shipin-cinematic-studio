/**
 * SPRINT-ECO-03 — Ecology Runtime Routes
 * KAOR Runtime Boundary API：只读目录 / 能力矩阵 / 插件↔Runtime 映射 / 契约验证
 * 纪律：不执行插件 / 不接本地执行 / 不改 Hermes
 */
import type { FastifyInstance } from 'fastify';
import {
  ensureKaorRuntimeSeed,
  listRuntimes,
  getRuntime,
  bindPluginToRuntime,
  getPluginRuntimeMapping,
  RuntimeRegistryError,
} from '../ecosystem/runtime-registry.service.js';
import { hermesAdapter } from '../ecosystem/kaor/hermes-adapter.js';
import { KAOR_CAPABILITIES } from '../ecosystem/kaor/kaor-capabilities.js';

export async function registerEcologyRuntimeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/ecosystem/runtime — Runtime 目录（含能力声明）
   */
  app.get('/runtime', async (request: any, reply: any) => {
    try {
      const { prisma } = await import('../utils/index.js');
      const runtimes = await listRuntimes(prisma);
      return reply.send({ code: 0, data: { runtimes, total: runtimes.length } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `Runtime 目录查询失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/runtime/capabilities — 能力矩阵（SSOT：KAOR_CAPABILITIES）
   */
  app.get('/runtime/capabilities', async (_request: any, reply: any) => {
    try {
      const { prisma } = await import('../utils/index.js');
      await ensureKaorRuntimeSeed(prisma);
      return reply.send({ code: 0, data: { runtime: 'kaor', capabilities: KAOR_CAPABILITIES } });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `能力矩阵查询失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/runtime/:runtimeId — Runtime 详情
   */
  app.get('/runtime/:runtimeId', async (request: any, reply: any) => {
    try {
      const { runtimeId } = request.params as { runtimeId: string };
      const { prisma } = await import('../utils/index.js');
      const runtime = await getRuntime(prisma, runtimeId);
      if (!runtime) return reply.code(404).send({ code: 404, message: 'Runtime 不存在' });
      return reply.send({ code: 0, data: runtime });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `Runtime 详情查询失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/runtime/mapping/:pluginId — 插件 ↔ Runtime 能力映射（G4）
   */
  app.get('/runtime/mapping/:pluginId', async (request: any, reply: any) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const { prisma } = await import('../utils/index.js');
      const mapping = await getPluginRuntimeMapping(prisma, pluginId);
      if (!mapping) return reply.code(404).send({ code: 404, message: '插件不存在' });
      return reply.send({ code: 0, data: mapping });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `映射查询失败: ${e.message}` });
    }
  });

  /**
   * POST /api/ecosystem/runtime/mapping/:pluginId/bind — 建立插件 ↔ KAOR 绑定（幂等）
   */
  app.post('/runtime/mapping/:pluginId/bind', async (request: any, reply: any) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const { prisma } = await import('../utils/index.js');
      const result = await bindPluginToRuntime(prisma, pluginId);
      return reply.send({ code: 0, data: result });
    } catch (e: any) {
      if (e instanceof RuntimeRegistryError) {
        return reply.code(404).send({ code: 404, message: e.message, errorCode: e.code });
      }
      return reply.code(500).send({ code: 500, message: `绑定失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/runtime/contract/probe — HermesAdapter 契约探针（只读验证映射，不执行插件）
   * 验证 KAOR 接口 ↔ 现有 Hermes 的委托映射链路可用
   */
  app.get('/runtime/contract/probe', async (_request: any, reply: any) => {
    try {
      const capabilities = hermesAdapter.getCapabilities();
      const probe = {
        runtimeId: hermesAdapter.runtimeId,
        adapterName: hermesAdapter.adapterName,
        version: hermesAdapter.version,
        capabilities: capabilities.map((c) => ({ code: c.code, status: c.status, hermesMapping: c.hermesMapping })),
      };
      return reply.send({ code: 0, data: probe });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `契约探针失败: ${e.message}` });
    }
  });

  /**
   * GET /api/ecosystem/runtime-health — Runtime 层健康检查
   */
  app.get('/runtime-health', async (_request: any, reply: any) => {
    try {
      const { prisma } = await import('../utils/index.js');
      const [runtimes, capabilities, bindings] = await Promise.all([
        prisma.ecologyRuntime.count(),
        prisma.ecologyRuntimeCapability.count(),
        prisma.ecologyPluginRuntimeBinding.count({ where: { status: 'bound' } }),
      ]);
      return reply.send({
        code: 0,
        data: {
          status: 'ok',
          runtimes,
          capabilities,
          bindings,
          layer: 'kaor-runtime-boundary',
          sprint: 'ECO-03',
        },
      });
    } catch (e: any) {
      return reply.code(500).send({ code: 500, message: `Runtime 健康检查失败: ${e.message}` });
    }
  });
}
