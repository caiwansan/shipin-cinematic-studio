/**
 * S2.1 Plugin Registry Adapter Routes — 只读查询（模式对齐现有 ecology）
 * 依据: KUNLUN-S2.1-PLUGIN-REGISTRY-DESIGN-REVIEW.md
 * 原则: 只读消费（GET）；不写 Registry；不改现有 ecology 端点
 */
import type { FastifyInstance } from 'fastify'
import { listRegistryPlugins, getRegistryPlugin, getHermesBinding } from '../ecosystem/plugin-registry-adapter.js'

export async function registerEcologyRegistryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Registry 目录
  app.get('/registry/plugins', async (request: any, reply: any) => {
    try {
      const orgId = (request as any).orgId || (request as any).organizationId || undefined
      const entries = await listRegistryPlugins(orgId)
      return reply.send({ code: 0, data: { plugins: entries } })
    } catch (e: any) {
      request.log.error(e, 'registry/plugins failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // 单插件
  app.get('/registry/plugins/:pluginId', async (request: any, reply: any) => {
    try {
      const orgId = (request as any).orgId || undefined
      const entry = await getRegistryPlugin(request.params.pluginId, orgId)
      if (!entry) return reply.code(404).send({ error: 'PLUGIN_NOT_FOUND' })
      return reply.send({ code: 0, data: entry })
    } catch (e: any) {
      request.log.error(e, 'registry/plugins/:id failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // Hermes 绑定声明（只读，不执行）
  app.get('/registry/plugins/:pluginId/hermes-binding', async (request: any, reply: any) => {
    try {
      const binding = await getHermesBinding(request.params.pluginId)
      if (!binding) return reply.code(404).send({ error: 'PLUGIN_NOT_FOUND' })
      return reply.send({ code: 0, data: binding })
    } catch (e: any) {
      request.log.error(e, 'registry/hermes-binding failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
