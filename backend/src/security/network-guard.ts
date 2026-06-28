/**
 * security/network-guard.ts — 网络边界防护（DNS / IP / redirect）
 *
 * 与 url-policy.ts、safe-fetch.ts 配合，处理低层网络安全检查。
 * 特别用于 file:// 下载（非 fetch）场景下的 IP 校验。
 */

import { resolve4 } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isIpBlocked, resolveAndCheckHost } from './url-policy.js'

export interface UrlSafetyResult {
  safe: boolean
  reason?: string
  resolvedIp?: string | null
  hostname: string
  port: number
}

/**
 * 全链路 URL 安全 + DNS 解析检查
 * 用于替代 fetch 之外的原始 TCP/http 调用
 */
export async function checkUrlSafety(url: string): Promise<UrlSafetyResult> {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: `协议禁止: ${parsed.protocol}`, hostname: parsed.hostname, port: parseInt(parsed.port) || 80 }
    }

    const dnsCheck = await resolveAndCheckHost(parsed.hostname)
    if (!dnsCheck.ok) {
      return {
        safe: false,
        reason: `DNS 解析后 IP 在黑名单: ${dnsCheck.resolvedIp}`,
        hostname: parsed.hostname,
        port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        resolvedIp: dnsCheck.resolvedIp,
      }
    }

    return {
      safe: true,
      hostname: parsed.hostname,
      port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      resolvedIp: dnsCheck.resolvedIp,
    }
  } catch (err) {
    return { safe: false, reason: `URL 解析失败: ${(err as Error).message}`, hostname: '', port: 0 }
  }
}

/**
 * 检查原始 IP 是否安全
 * 用于 socket / net 连接前校验
 */
export function checkIpSafety(ip: string): { safe: boolean; reason?: string } {
  if (!isIP(ip)) {
    return { safe: false, reason: `非法 IP 格式: ${ip}` }
  }
  if (isIpBlocked(ip)) {
    return { safe: false, reason: `IP 在内网黑名单: ${ip}` }
  }
  return { safe: true }
}
