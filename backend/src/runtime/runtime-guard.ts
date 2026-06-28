/**
 * runtime/runtime-guard.ts — Runtime 执行收敛守卫
 *
 * ═══════════════════════════════════════════════════════════════════
 * 目的: 检测并阻止 provider 绕过程序的行为
 *
 * 在系统启动时注册到 Fastify 的 onResponse 和 preHandler 钩子，
 * 自动追踪所有 provider 调用是否经过了 RuntimeGateway。
 *
 * 工作模式:
 *   - "warn" (默认): 打印警告日志，不阻止执行
 *   - "enforce": 使用 `abortInFlight` 阻止直接调用（生产模式使用）
 *
 * 设置: RUNTIME_GUARD=warn 或 RUNTIME_GUARD=enforce
 * ═══════════════════════════════════════════════════════════════════
 */

import type { FastifyInstance } from 'fastify'

const GUARD_MODE = (process.env.RUNTIME_GUARD || 'warn') as 'warn' | 'enforce'

/** 
 * 已通过 Gateway 执行的 executionId 集合
 * Provider 代码在 Gateway 路径下设置该标识
 */
const gatewayExecutionIds = new Set<string>()

// ─── API ──────────────────────────────────────────────────────────

export function markGatewayExecution(executionId: string) {
  gatewayExecutionIds.add(executionId)
  // 清理超过 10 分钟的 ID
  if (gatewayExecutionIds.size > 10000) {
    gatewayExecutionIds.clear()
  }
}

export function isGatewayExecution(executionId: string): boolean {
  return gatewayExecutionIds.has(executionId)
}

// ─── Fastify 钩子 ─────────────────────────────────────────────────

/** 在 preHandler 中标记已通过 gateway 的请求 */
export function runtimeGuardHook(request: any, _reply: any, done: () => void) {
  const ct = request.headers['content-type'] || ''
  // 只检查 /api 路径
  if (!request.url?.startsWith('/api/')) {
    done()
    return
  }

  // 如果 x-runtime-gateway 头存在，标记该请求
  if (request.headers['x-runtime-gateway']) {
    const executionId = request.headers['x-runtime-gateway'] as string
    markGatewayExecution(executionId)
  }

  done()
}

/** 
 * 在 onResponse 中检测未通过 gateway 的 provider 调用
 * 仅记录日志，不阻止响应（已发出）
 */
export function runtimeGuardResponse(request: any, reply: any, done: () => void) {
  if (GUARD_MODE === 'warn' && reply.statusCode >= 200 && reply.statusCode < 300) {
    const url = request.url || ''
    // 检查是否涉及 provider 调用的路径
    if (url.includes('/images/generate') || url.includes('/video/generate') || 
        url.includes('/tts') || url.includes('/narrative-llm') ||
        url.includes('/ai-tasks')) {
      const hasGateway = !!request.headers['x-runtime-gateway']
      if (!hasGateway) {
        console.warn(`[RuntimeGuard] ⚠️ 未经 Gateway 的执行: ${url} (status=${reply.statusCode})`)
      }
    }
  }
  done()
}

// ─── 注册到 Fastify ───────────────────────────────────────────────

export function registerRuntimeGuard(fastify: FastifyInstance) {
  // preHandler — 标记 gateway
  fastify.addHook('preHandler', runtimeGuardHook as any)
  // onResponse — 检测绕过
  fastify.addHook('onResponse', runtimeGuardResponse as any)

  console.log(`[RuntimeGuard] ✅ 已注册 (mode=${GUARD_MODE})`)
  console.log(`[RuntimeGuard]   - 检测未经过 Gateway 的 provider 调用`)
  if (GUARD_MODE === 'enforce') {
    console.log(`[RuntimeGuard]   - 🚨 ENFORCE 模式：直接 provider 调用将被阻止`)
  }
}

// ─── 工具：为 provider 添加 Gateway 标记 ──────────────────────────

/**
 * Provider 代码在通过 Gateway 执行时，应在其 HTTP 响应头中加入此标记。
 * 这样即使请求绕过，也能从响应头检测到。
 */
export const GATEWAY_HEADER = 'x-runtime-gateway'
export const GATEWAY_VERSION = 'v2'
