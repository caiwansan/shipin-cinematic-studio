/**
 * audits/ssrf-observer/calibration-reporter.ts
 *
 * 24h SSRF Calibration Reporter
 * 从 safeFetch shadow log 提取统计数据。
 *
 * 用法：tsx src/audits/ssrf-observer/calibration-reporter.ts
 * 输出：audit/ssrf-calibration-report.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface ShadowLogEntry {
  t: string
  level: 'block' | 'warn' | 'info'
  requestId: string
  url: string
  status?: number
  elapsedMs?: number
  mode: string
  reason?: string
  resolvedIp?: string
}

export interface CalibrationReport {
  generatedAt: string
  totalEntries: number
  timeRange: { from: string; to: string }
  byLevel: Record<string, number>
  byProtocol: Record<string, number>
  riskDistribution: {
    internal: number        // 内网/回环
    cdnOSS: number          // CDN/OSS 合法
    external: number        // 外网正常
    unknown: number
  }
  topHostnames: Array<{ hostname: string; count: number }>
  redirectEntries: Array<ShadowLogEntry>
  blockedPatterns: Array<ShadowLogEntry>
  recommendation: string
}

// ─── IP 检测 ──────────────────────────────────

function isInternalHost(hostname: string): boolean {
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
         /^localhost$/i.test(hostname)
}

function isCdnOrOss(hostname: string): boolean {
  return /\.oss-[\w-]*\.aliyuncs\.com|dashscope|\.cos\.|\bfile\.|\bimg\.|\bcache\.|\.volces\.com/i.test(hostname)
}

function extractHostname(url: string): string {
  try { return new URL(url).hostname } catch { return '?' }
}

// ─── 主函数 ──────────────────────────────────

export function generateCalibrationReport(logDir: string = join(process.cwd(), 'audit')): CalibrationReport {
  const logPath = join(logDir, 'ssrf-shadow.log')

  if (!existsSync(logPath)) {
    return {
      generatedAt: new Date().toISOString(),
      totalEntries: 0,
      timeRange: { from: '', to: '' },
      byLevel: {},
      byProtocol: {},
      riskDistribution: { internal: 0, cdnOSS: 0, external: 0, unknown: 0 },
      topHostnames: [],
      redirectEntries: [],
      blockedPatterns: [],
      recommendation: 'No data yet — safeFetch has not processed any requests.',
    }
  }

  const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
  const entries: ShadowLogEntry[] = lines.map(l => JSON.parse(l))

  const byLevel: Record<string, number> = {}
  const byProtocol: Record<string, number> = {}
  const hostnameCount: Record<string, number> = {}
  const redirectEntries: ShadowLogEntry[] = []
  const blockedPatterns: ShadowLogEntry[] = []

  let internal = 0
  let cdnOSS = 0
  let external = 0
  let unknown = 0

  for (const e of entries) {
    byLevel[e.level] = (byLevel[e.level] || 0) + 1

    const proto = e.url.startsWith('https') ? 'https' : 'http'
    byProtocol[proto] = (byProtocol[proto] || 0) + 1

    const host = extractHostname(e.url)
    hostnameCount[host] = (hostnameCount[host] || 0) + 1

    // risk classification
    if (isInternalHost(host)) internal++
    else if (isCdnOrOss(host)) cdnOSS++
    else if (host !== '?') external++
    else unknown++

    // redirect
    if (e.status && e.status >= 300 && e.status < 400) redirectEntries.push(e)
    if (e.level === 'warn' || e.level === 'block') blockedPatterns.push(e)
  }

  const sortedHostnames = Object.entries(hostnameCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([hostname, count]) => ({ hostname, count }))

  const timeRange = entries.length >= 2
    ? { from: entries[0].t, to: entries[entries.length - 1].t }
    : { from: entries[0]?.t ?? '', to: entries[0]?.t ?? '' }

  // 自动推荐
  const recommendation = generateRecommendation(internal, cdnOSS, external, redirectEntries)

  return {
    generatedAt: new Date().toISOString(),
    totalEntries: entries.length,
    timeRange,
    byLevel,
    byProtocol,
    riskDistribution: { internal, cdnOSS, external, unknown },
    topHostnames: sortedHostnames,
    redirectEntries,
    blockedPatterns,
    recommendation,
  }
}

function generateRecommendation(
  internal: number,
  cdnOSS: number,
  external: number,
  redirectEntries: ShadowLogEntry[]
): string {
  const parts: string[] = []

  if (internal > 0) {
    parts.push(`⚠️ 发现 ${internal} 次内网/回环请求 — 需要确认是否合法（微服务互通？）`)
  }
  if (cdnOSS > 0) {
    parts.push(`✅ ${cdnOSS} 次 CDN/OSS 请求 — 可加入自动白名单`)
  }
  if (redirectEntries.length > 0) {
    parts.push(`⚠️ ${redirectEntries.length} 次重定向 — 需要检查跨域跳转`)
  }
  if (openRedirectPatterns(redirectEntries)) {
    parts.push('🔴 发现开放重定向模式 — 必须在 enforce 前处理')
  }

  if (internal === 0 && redirectEntries.length === 0) {
    parts.push('✅ 未发现内网请求或危险重定向 — 可直接考虑 enforce mode')
  }

  parts.push(`建议：等待更多数据收集（至少 100 条外部请求）后再做 enforce 决策`)
  return parts.join('\n')
}

function openRedirectPatterns(entries: ShadowLogEntry[]): boolean {
  return entries.some(e =>
    e.url.startsWith('http') &&
    !e.url.includes('.aliyuncs.com') &&
    !e.url.includes('.volces.com')
  )
}

// ─── CLI 入口 ──────────────────────────────────

if (require.main === module) {
  const report = generateCalibrationReport()
  const outDir = join(process.cwd(), 'audit')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'ssrf-calibration-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`📊 Calibration report written to ${outPath}`)
  console.log(`   总记录: ${report.totalEntries}`)
  console.log(`   内网: ${report.riskDistribution.internal} / CDN/OSS: ${report.riskDistribution.cdnOSS} / 外网: ${report.riskDistribution.external}`)
  console.log(`   重定向: ${report.redirectEntries.length} / 警告: ${report.blockedPatterns.length}`)
}
