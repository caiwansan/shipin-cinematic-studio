/**
 * audits/ssrf-observer/url-classifier.ts
 *
 * URL 分类器 — 将每个 SSRF 请求按来源/类型自动打标。
 * 不拦截，只标记。用于 24h Calibration。
 *
 * 分类维度：
 *   - origin: user_input | db_field | internal_api | unknown
 *   - target: cdn | oss | volcengine | aliyun | internal | external | loopback
 *   - risk: 0-100
 *   - protocol: http | https
 *   - redirect_trace: string[]
 */

export interface ClassifiedObservation {
  timestamp: string
  requestId: string
  url: string
  status: number | null
  elapsedMs: number
  redirected: boolean
  redirectChain: string[]
  // 分类
  origin: 'user_input' | 'db_field' | 'internal_api' | 'unknown'
  target: 'cdn' | 'oss' | 'volcengine' | 'aliyun' | 'internal' | 'external' | 'loopback' | 'unknown'
  risk: number      // 0-100
  // 地理位置 hint
  resolvedIp: string | null
  hostname: string
  // 哪个模块发出的
  sourceFile: string
  operation: 'fetch' | 'download' | 'proxy' | 'ffmpeg_source'
}

// ─── 已知服务域名白名单 ──────────────────────────

const KNOWN_SERVICES: Array<{
  pattern: RegExp
  target: ClassifiedObservation['target']
  risk: number
  label: string
}> = [
  { pattern: /\.volces\.com$/i,       target: 'volcengine', risk: 10, label: '火山引擎 API' },
  { pattern: /\.volcengineapi\.com$/i,target: 'volcengine', risk: 10, label: '火山引擎 API' },
  { pattern: /\.oss-[\w-]+\.aliyuncs\.com$/i, target: 'oss', risk: 5, label: '阿里云 OSS' },
  { pattern: /dashscope[\w-]*\.aliyuncs\.com/i, target: 'aliyun', risk: 10, label: '阿里百炼' },
  { pattern: /\.cos\.[\w-]+\.myqcloud\.com$/i, target: 'cdn', risk: 5, label: '腾讯云 COS' },
  { pattern: /127\.0\.0\.1/,          target: 'loopback', risk: 70, label: '本地回环' },
  { pattern: /localhost/i,             target: 'loopback', risk: 70, label: '本地回环' },
  { pattern: /^https?:\/\/10\./,      target: 'internal', risk: 85, label: '内网 10.x' },
  { pattern: /^https?:\/\/192\.168\./,target: 'internal', risk: 85, label: '内网 192.168.x' },
  { pattern: /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./, target: 'internal', risk: 85, label: '内网 172.16-31.x' },
  { pattern: /^https?:\/\/169\.254\./,target: 'internal', risk: 85, label: '链路本地 169.254.x' },
]

export function classifyUrl(url: string, sourceFile: string, operation: ClassifiedObservation['operation'], resolvedIp?: string | null): ClassifiedObservation {
  const hostname = extractHostname(url)
  const now = new Date().toISOString()

  // 找匹配的已知服务
  let target: ClassifiedObservation['target'] = 'external'
  let risk = 50
  let label = 'unknown'

  for (const svc of KNOWN_SERVICES) {
    if (svc.pattern.test(url) || svc.pattern.test(hostname)) {
      target = svc.target
      risk = svc.risk
      label = svc.label
      break
    }
  }

  // 根据协议调风险
  const protocol = url.startsWith('https') ? 'https' : 'http'
  if (protocol === 'http' && target === 'external') {
    risk = Math.max(risk, 65) // 非 HTTPS 外部请求
  }

  // 根据来源调风险
  if (target === 'loopback' && operation === 'proxy') {
    risk = 90                     // proxy 路由对内 — 非常危险
  }

  const requestId = `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  return {
    timestamp: now,
    requestId,
    url: truncateUrl(url),
    status: null,
    elapsedMs: 0,
    redirected: false,
    redirectChain: [],
    origin: 'unknown',
    target,
    risk,
    resolvedIp: resolvedIp ?? null,
    hostname,
    sourceFile,
    operation,
  }
}

export function updateObservationWithResponse(
  obs: ClassifiedObservation,
  status: number,
  elapsedMs: number,
  redirectChain: string[] = []
): ClassifiedObservation {
  return {
    ...obs,
    status,
    elapsedMs,
    redirected: redirectChain.length > 0,
    redirectChain,
    // 如果返回了 302，风险更高
    risk: status >= 300 && status < 400 ? Math.min(obs.risk + 20, 100) : obs.risk,
  }
}

// ─── 工具函数 ──────────────────────────────────

function extractHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function truncateUrl(url: string, maxLen: number = 120): string {
  return url.length <= maxLen ? url : url.slice(0, maxLen) + '...'
}
