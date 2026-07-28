/**
 * security/url-policy.ts — SSRF URL Policy Constitution
 *
 * 唯一真相源。所有外部 URL 请求必须通过此处定义的安全策略。
 * 本文件是"宪法"，不是工具函数。不可绕过。
 *
 * 宪法条款：
 * 1. 协议白名单：仅允许 http / https
 * 2. 禁止内网 IP 段：10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 192.168.0.0/16
 * 3. DNS resolve 后二次校验目标 IP（防 DNS rebinding）
 * 4. 禁止跟随跨域 302 重定向
 * 5. 最大重定向深度：1 层（同域）
 * 6. 超时：15s 连接 + 30s 总
 * 7. 最大响应体：50MB
 */

import { resolve4 } from 'node:dns/promises'
import { isIP } from 'node:net'

// ─── 黑名单子网（CIDR） ────────────────────────────────

export const BLOCKED_NETWORKS: string[] = [
  '10.0.0.0/8',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '192.168.0.0/16',
  '172.16.0.0/12',
  '0.0.0.0/8',
  '224.0.0.0/4',  // 多播
  '240.0.0.0/4',  // 保留
]

// ─── 策略常量 ──────────────────────────────────────────

export const POLICY = {
  ALLOWED_PROTOCOLS: ['http:', 'https:'] as string[],
  MAX_REDIRECT_DEPTH: 1 as number,
  CONNECT_TIMEOUT_MS: 15_000,
  TOTAL_TIMEOUT_MS: 30_000,
  MAX_BODY_BYTES: 50 * 1024 * 1024,
  ALLOW_REDIRECT_CROSS_ORIGIN: false,
} as const

// ─── 运行时标志 ────────────────────────────────────────

// Sprint 13: Security P0 — 默认 enforce 模式生效
// shadow 模式已淘汰。如需临时关闭请设置 SSR_FORCE_SHADOW=true
export const SSRF_MODE: 'shadow' | 'enforce' = (
  process.env.SSRF_FORCE_SHADOW === 'true' ? 'shadow' : 'enforce'
)

// ─── IP → CIDR 匹配 ────────────────────────────────────

function ipToUint32(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function cidrToRange(cidr: string): [number, number] | null {
  const [ipStr, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits) || bits < 0 || bits > 32) return null
  const ip = ipToUint32(ipStr)
  if (ip === null) return null
  const mask = ~(0xFFFFFFFF >>> bits) >>> 0
  return [ip & mask, ip | ~mask]
}

function ipInCidr(ip: string, cidr: string): boolean {
  const ipNum = ipToUint32(ip)
  if (ipNum === null) return false
  const range = cidrToRange(cidr)
  if (!range) return false
  return ipNum >= range[0] && ipNum <= range[1]
}

// ─── 外部接口 ──────────────────────────────────────────

/**
 * 检查 IP 是否在黑名单子网中
 */
export function isIpBlocked(ip: string): boolean {
  return BLOCKED_NETWORKS.some(cidr => ipInCidr(ip, cidr))
}

/**
 * 对 URL 的 host 进行 DNS 解析后检查是否指向内网
 * 防 DNS rebinding attack
 */
export async function resolveAndCheckHost(hostname: string): Promise<{ ok: boolean; resolvedIp: string | null }> {
  // 已经是 IP 的情况
  if (isIP(hostname)) {
    return { ok: !isIpBlocked(hostname), resolvedIp: hostname }
  }

  try {
    // DNS A 记录解析
    const ips = await resolve4(hostname)
    for (const ip of ips) {
      if (isIpBlocked(ip)) {
        return { ok: false, resolvedIp: ip }
      }
    }
    return { ok: true, resolvedIp: ips[0] || null }
  } catch {
    return { ok: false, resolvedIp: null }
  }
}

/**
 * URL 策略校验（不包含 DNS resolve）
 */
export function checkUrlPolicy(url: string): { ok: boolean; reason?: string; hostname: string } {
  try {
    const parsed = new URL(url)

    // 协议检查
    if (!POLICY.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { ok: false, reason: `禁止的协议: ${parsed.protocol}`, hostname: parsed.hostname }
    }

    return { ok: true, hostname: parsed.hostname }
  } catch {
    return { ok: false, reason: 'URL 格式非法', hostname: '' }
  }
}
