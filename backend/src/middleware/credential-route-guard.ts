// src/middleware/credential-route-guard.ts
// FIX 2026-07-24: Route 层凭证边界守卫
// 禁止 HTTP 请求直接携带 apiKey / secret / token
// 所有凭证必须通过 Credential Resolver 解析

import type { FastifyReply, FastifyRequest } from 'fastify'

const FORBIDDEN_BODY_FIELDS = ['apiKey', 'secret', 'token', 'privateKey', 'api_key'] as const
const FORBIDDEN_QUERY_FIELDS = ['apiKey', 'secret', 'token', 'access_token'] as const
const FORBIDDEN_HEADER_FIELDS = ['x-api-key', 'x-secret', 'x-token'] as const

/**
 * 检测请求中是否包含明文凭证
 */
export function detectCredentialInRequest(req: FastifyRequest): string | null {
  // 检查 body
  if (req.body && typeof req.body === 'object') {
    for (const field of FORBIDDEN_BODY_FIELDS) {
      if ((req.body as any)[field]) return `body.${field}`
    }
  }

  // 检查 query
  if (req.query) {
    for (const field of FORBIDDEN_QUERY_FIELDS) {
      if ((req.query as any)[field]) return `query.${field}`
    }
  }

  // 检查 headers
  for (const field of FORBIDDEN_HEADER_FIELDS) {
    if (req.headers[field]) return `header.${field}`
  }

  return null
}

/**
 * Route 层凭证守卫 Middleware
 * 注册到所有 AI 相关路由
 */
export async function credentialRouteGuard(req: FastifyRequest, reply: FastifyReply) {
  const violation = detectCredentialInRequest(req)
  if (violation) {
    reply.status(400).json({
      error: 'CREDENTIAL_IN_REQUEST',
      message: `Field '${violation}' is not allowed in request. All credentials must be resolved via Credential Authority.`,
      constitution: 'KMKI-AUTHORITY-CONSTITUTION-v0.1',
    })
    return
  }
}

/**
 * 注册 Credential Guard 到 Fastify 实例
 * 仅应用于 AI 相关路由
 */
export async function registerCredentialRouteGuard(app: any) {
  app.addHook('preHandler', async (request: any, reply: any) => {
    // 仅对 AI 相关路由生效
    if (!request.url?.match(/\/api\/(ai|ecom|hdz|voice|image|video|llm|providers|generate|analyze)/)) {
      return
    }
    await credentialRouteGuard(request, reply)
  })
}
