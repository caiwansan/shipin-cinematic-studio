/**
 * security/safe-fetch.ts — 唯一网络出口
 *
 * 代替原生 fetch、http.get、https.get 的唯一封装层。
 * 规则由 url-policy.ts 集中定义。
 *
 * 运行模式：
 *   shadow: 记录违规日志但放行（默认）
 *   enforce: 拦截违规请求
 *
 * 日志输出到 /audit/ssrf-shadow.log 格式 JSONL
 */

import { createWriteStream, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { checkUrlPolicy, resolveAndCheckHost, SSRF_MODE, isIpBlocked, POLICY } from './url-policy.js'

// ─── 审计日志 ──────────────────────────────────────────

const LOG_DIR = join(process.cwd(), 'audit')
const LOG_PATH = join(LOG_DIR, 'ssrf-shadow.log')

let logStream: ReturnType<typeof createWriteStream> | null = null

function ensureLogStream(): ReturnType<typeof createWriteStream> {
  if (!logStream) {
    mkdirSync(LOG_DIR, { recursive: true })
    logStream = createWriteStream(LOG_PATH, { flags: 'a' })
  }
  return logStream
}

function logSsfrEvent(level: 'block' | 'warn' | 'info', event: Record<string, unknown>) {
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), level, ...event }) + '\n'
    ensureLogStream().write(line)
  } catch {
    // 日志失败不应影响请求
  }
}

// ─── 错误类型 ──────────────────────────────────────────

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'PROTOCOL' | 'BLOCKED_IP' | 'DNS_FAIL' | 'TIMEOUT' | 'TOO_LARGE' | 'REDIRECT_DENIED',
    public readonly url: string
  ) {
    super(message)
    this.name = 'SafeFetchError'
  }
}

// ─── Safe Fetch 选项 ───────────────────────────────────

export interface SafeFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  timeout?: number
  maxRedirects?: number
  allowCrossOriginRedirect?: boolean
  signal?: AbortSignal
  /** 执行意图标签 — 纯观测字段，不参与任何策略判断 */
  intent?: 'image_proxy' | 'video_render_source' | 'webhook_callback' | 'llm_tool_fetch' | 'user_input_fetch' | 'internal_service_call' | 'unknown'
}

// ─── 核心函数 ──────────────────────────────────────────

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const startMs = Date.now()
  const requestId = `sf_${startMs}_${Math.random().toString(36).slice(2, 6)}`
  const intent = options.intent ?? 'unknown'  // 纯观测字段，不参与策略判断

  // Step 1: URL 策略校验
  const policyCheck = checkUrlPolicy(url)
  if (!policyCheck.ok) {
    logSsfrEvent('warn', {
      requestId,
      url,
      intent,
      reason: policyCheck.reason,
      mode: SSRF_MODE,
    })
    if (SSRF_MODE === 'enforce') {
      throw new SafeFetchError(policyCheck.reason!, 'PROTOCOL', url)
    }
  }

  // Step 2: DNS resolve + IP 检查
  const dnsCheck = await resolveAndCheckHost(policyCheck.hostname)
  if (!dnsCheck.ok) {
    logSsfrEvent('warn', {
      requestId,
      url,
      intent,
      resolvedIp: dnsCheck.resolvedIp,
      reason: '目标 IP 在黑名单中（DNS resolve 后）',
      mode: SSRF_MODE,
    })
    if (SSRF_MODE === 'enforce') {
      throw new SafeFetchError(`目标 IP ${dnsCheck.resolvedIp} 被策略禁止`, 'BLOCKED_IP', url)
    }
  }

  // Step 3: 实际请求（用原生 fetch，安全策略已在前面执行）
  const timeoutMs = options.timeout ?? POLICY.TOTAL_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // 合并外部 signal
  const combinedSignal = options.signal
    ? combineAbortSignals(controller.signal, options.signal)
    : controller.signal

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: combinedSignal,
      // 禁止自动跟随 redirect，由我们自己判断
      redirect: 'manual',
    })

    clearTimeout(timeoutId)

    // Step 4: 重定向策略
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        const maxRedirects = options.maxRedirects ?? POLICY.MAX_REDIRECT_DEPTH
        const allowCross = options.allowCrossOriginRedirect ?? POLICY.ALLOW_REDIRECT_CROSS_ORIGIN

        if (maxRedirects <= 0) {
          logSsfrEvent('block', {
            requestId,
            url,
            intent,
            redirectTo: location,
            reason: '超过最大重定向深度',
            mode: 'enforce',
          })
          throw new SafeFetchError('超过最大重定向深度', 'REDIRECT_DENIED', url)
        }

        if (!allowCross) {
          const originHost = new URL(url).hostname
          const redirectHost = new URL(location).hostname
          if (originHost !== redirectHost) {
            logSsfrEvent('block', {
              requestId,
              url,
              intent,
              redirectTo: location,
              reason: '跨域重定向被禁止',
              originHost,
              redirectHost,
              mode: 'enforce',
            })
            throw new SafeFetchError('跨域重定向被禁止', 'REDIRECT_DENIED', url)
          }
        }

        // 递归跟随同域重定向
        return safeFetch(location, { ...options, maxRedirects: maxRedirects - 1 })
      }
    }

    // Step 5: 响应体大小检查
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > POLICY.MAX_BODY_BYTES) {
      logSsfrEvent('block', {
        requestId,
        url,
        intent,
        contentLength: parseInt(contentLength, 10),
        reason: '响应体超过限制',
        mode: SSRF_MODE,
      })
      if (SSRF_MODE === 'enforce') {
        throw new SafeFetchError('响应体超过限制', 'TOO_LARGE', url)
      }
    }

    // ✓ 通过全部检查
    const elapsed = Date.now() - startMs
    logSsfrEvent('info', {
      requestId,
      url,
      intent,
      status: response.status,
      elapsedMs: elapsed,
      mode: SSRF_MODE,
    })

    return response
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof SafeFetchError) throw err
    if ((err as Error)?.name === 'AbortError') {
      throw new SafeFetchError('请求超时', 'TIMEOUT', url)
    }
    throw err
  }
}

// ─── 工具函数 ──────────────────────────────────────────

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}
