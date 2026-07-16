/**
 * Enterprise Reality Layer — Tenant Ownership Guard
 *
 * 防止水平越权：确保 URL tenantId 与 JWT 用户的 tenantId 一致。
 * 所有包含 :tenantId 参数的企业路由都必须注册此 preHandler。
 *
 * 用法：
 *   app.addHook('preHandler', app.authenticate)
 *   app.addHook('preHandler', tenantOwnershipGuard)
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { validateTenantOwnership, isDemoTenant } from '../reality/demo-boundary.js'

export async function tenantOwnershipGuard(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as any
  const params = request.params as any

  // 只对包含 tenantId 参数的请求生效
  if (!params?.tenantId) return

  const urlTenantId = params.tenantId
  const jwtTenantId = user?.tenantId || user?.id

  const result = validateTenantOwnership(urlTenantId, jwtTenantId, user?.id)

  if (!result.valid) {
    return reply.status(403).send({
      code: 403,
      message: 'Forbidden: Tenant ownership mismatch',
      reason: result.reason,
    })
  }

  // 将解析后的 tenantId 挂载到 request，方便后续 route handler 使用
  ;(request as any).resolvedTenantId = result.resolvedTenantId
}
