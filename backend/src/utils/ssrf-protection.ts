/**
 * ssrf-protection.ts — SSRF 防护工具
 *
 * 统一域名白名单校验，防止服务器对内网/私密地址发起请求。
 * 所有代理/下载外部 URL 的代码必须调用 isValidProxyUrl() 或 guardExternalUrl()。
 */

import { URL } from 'url'

/** 允许代理的域名后缀 */
const ALLOWED_HOST_SUFFIXES = [
  '.tos-cn-beijing.volces.com', // 火山 TOS
  '.volces.com',                // 火山引擎
  '.cos.ap-guangzhou.myqcloud.com',  // 腾讯云 COS
  '.cos.ap-beijing.myqcloud.com',
  '.cos.ap-shanghai.myqcloud.com',
  '.cos.ap-nanjing.myqcloud.com',
  '.cos.ap-chengdu.myqcloud.com',
  '.cos.ap-shenzhen-fsi.myqcloud.com',
  '.myqcloud.com',              // 腾讯云 COS 通配
  '.oss-cn-hangzhou.aliyuncs.com',    // 阿里云 OSS
  '.oss-cn-beijing.aliyuncs.com',
  '.oss-cn-shenzhen.aliyuncs.com',
  '.oss-cn-shanghai.aliyuncs.com',
  '.aliyuncs.com',              // 阿里云 OSS 通配
]

/** 完整域名精确匹配 */
const EXACT_ALLOWED = [
  'tos-cn-beijing.volces.com',
  'volces.com',
]

/** 内部网络黑名单 */
const PRIVATE_IPS = [
  '127.0.0.1',
  '::1',
  'localhost',
  '0.0.0.0',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '169.254.',
  '100.100.',   // 阿里云 metadata
  '100.64.',
]

const PRIVATE_SUFFIXES = [
  '.internal',
  '.local',
  '.consul',
]

/** 校验 URL 是否可安全代理（白名单 + 非内网） */
export function isValidProxyUrl(urlStr: string): { valid: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { valid: false, reason: '无效的 URL 格式' }
  }

  const hostname = parsed.hostname.toLowerCase()

  // 精确匹配白名单
  if (EXACT_ALLOWED.includes(hostname)) {
    return { valid: true }
  }

  // 后缀匹配白名单
  for (const suffix of ALLOWED_HOST_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { valid: true }
    }
  }

  // 内网 IP/域名检查
  if (PRIVATE_IPS.some(p => hostname === p || hostname.startsWith(p))) {
    return { valid: false, reason: '禁止对内网/私有地址发起请求' }
  }
  if (PRIVATE_SUFFIXES.some(s => hostname.endsWith(s))) {
    return { valid: false, reason: '禁止对内部域名发起请求' }
  }

  return { valid: false, reason: 'URL 不在允许的域名白名单中' }
}

/** 抛出型守卫（用于 try/catch 流程） */
export function guardExternalUrl(urlStr: string): void {
  const result = isValidProxyUrl(urlStr)
  if (!result.valid) {
    throw new Error(`SSRF 防护: ${result.reason}`)
  }
}
