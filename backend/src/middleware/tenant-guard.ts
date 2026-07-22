// ============================================================
// Tenant Guard Middleware — KMKI Authority Compliance
// — Strictly forbids client-provided tenantId
// — Only extracts tenantId from JWT payload
// — FIX 2026-07-23: Upgrade per KMKI-AUTHORITY-CONSTITUTION
// ============================================================

/**
 * Resolve tenantId strictly from JWT.
 * Client-provided tenantId (body/query/header) is FORBIDDEN.
 */
export function resolveTenantId(request: any): string {
  // Block client-provided tenantId
  const clientTenantId =
    request.body?.tenantId ||
    request.query?.tenantId ||
    request.headers?.['x-tenant-id']

  if (clientTenantId) {
    throw new Error('TENANT_ID_FROM_JWT_ONLY: Client-provided tenantId is forbidden')
  }

  // Extract from JWT
  const tenantId = request.user?.organizationId

  if (!tenantId) {
    throw new Error('TENANT_ID_MISSING: No organization found in JWT')
  }

  return tenantId
}

export async function tenantGuard(request: any, reply: any) {
  // Skip unauthenticated (routes handle their own auth)
  if (!request.user) return

  try {
    const tenantId = resolveTenantId(request)
    request.tenantId = tenantId
  } catch (error: any) {
    return reply.status(403).send({
      error: 'TENANT_CONTEXT_INVALID',
      message: error.message,
      constitution: 'KMKI-AUTHORITY-CONSTITUTION-v0.1'
    })
  }
}

/**
 * 注册 Tenant Guard 到 Fastify 实例
 */
export async function registerTenantGuard(app: any) {
  app.addHook('preHandler', tenantGuard)
}
