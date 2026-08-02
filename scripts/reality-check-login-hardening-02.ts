/**
 * reality-check-login-hardening-02.ts — SPRINT-MEDIA-LOGIN-REALITY-HARDENING-02 验收
 *
 * Task02/04 — 平台登录策略配置 + Registry SSOT：
 *   L1 registry API 四平台 connectable + 策略齐全
 *   L2 无平台分支检查（probe/meta 无 if(platform==="xxx")）
 *   L3 meta 配置完整性（identityStrategy 全字段 + postScanBehavior 合法值）
 *   L4 judgeIdentityV2 纯函数回归
 *   L5 probe 策略驱动逻辑（identityStrategy 默认值 + network 通道开关）
 *
 * 用法: npx tsx scripts/reality-check-login-hardening-02.ts
 */
import { CHANNEL_META } from '../backend/src/enterprise/channel/adapters/browser-channel.meta.js'
import { judgeIdentityV2 } from '../backend/src/enterprise/channel/adapters/browser-channel.probe.js'
import { channelPlatformRegistry } from '../backend/src/enterprise/channel/platform-registry.js'

let pass = 0
let fail = 0
function assert(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${detail}`) }
}

console.log('══════ L1: Registry SSOT — 四平台 connectable + 策略 ══════')
channelPlatformRegistry.markAdapterReady('douyin')
channelPlatformRegistry.markProbeReady('douyin')
channelPlatformRegistry.markAdapterReady('kuaishou')
channelPlatformRegistry.markProbeReady('kuaishou')
channelPlatformRegistry.markAdapterReady('xiaohongshu')
channelPlatformRegistry.markProbeReady('xiaohongshu')
channelPlatformRegistry.markAdapterReady('channels_wechat')
channelPlatformRegistry.markProbeReady('channels_wechat')

for (const p of ['douyin', 'kuaishou', 'xiaohongshu', 'channels_wechat']) {
  const cap = channelPlatformRegistry.getCapability(p)
  assert(`[${p}] connectable=true (adapter+probe 双就绪)`, cap?.connectable === true, JSON.stringify(cap))
  assert(`[${p}] status=ready`, cap?.status === 'ready')
  assert(`[${p}] loginMethods 非空`, !!cap?.loginMethods.length)
  assert(`[${p}] identityStrategy 全字段`, cap?.identityStrategy &&
    typeof cap.identityStrategy.pageProbe === 'boolean' &&
    typeof cap.identityStrategy.cookieProbe === 'boolean' &&
    typeof cap.identityStrategy.networkCapture === 'boolean' &&
    typeof cap.identityStrategy.allowReload === 'boolean')
  assert(`[${p}] allowReload=false（扫码窗口期禁止 reload）`, cap?.identityStrategy?.allowReload === false)
}
assert('冻结平台 wechat_mp/weibo/toutiao/baijiahao 不 connectable',
  ['wechat_mp', 'weibo', 'toutiao', 'baijiahao'].every(p => channelPlatformRegistry.getCapability(p)?.connectable === false))

console.log('══════ L2: 禁止平台 if 分支 ══════')
import * as fs from 'fs'
import * as path from 'path'
const probeSrc = fs.readFileSync(path.resolve(__dirname, '../backend/src/enterprise/channel/adapters/browser-channel.probe.ts'), 'utf8')
const metaSrc = fs.readFileSync(path.resolve(__dirname, '../backend/src/enterprise/channel/adapters/browser-channel.meta.ts'), 'utf8')
const badPatterns = [
  /platform\s*===+\s*['"](douyin|kuaishou|xiaohongshu|channels_wechat)['"]/,
  /['"](douyin|kuaishou|xiaohongshu|channels_wechat)['"]\s*===+\s*platform/,
  /if\s*\(\s*platform/,
]
let bad = 0
for (const re of badPatterns) {
  // 跳过注释行（文件头「禁止 if(platform)」声明是文档，不是分支）
  const check = (src: string, label: string) => {
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      if (re.test(line)) {
        bad++
        console.log(`  ❌ ${label} 第 ${i + 1} 行命中平台分支: ${line.trim().slice(0, 80)}`)
      }
    })
  }
  check(probeSrc, 'probe.ts')
  check(metaSrc, 'meta.ts')
}
assert('probe.ts / meta.ts 无 if(platform) 分支（排除注释声明）', bad === 0)

console.log('══════ L3: meta 配置完整性 ══════')
for (const p of ['douyin', 'kuaishou', 'xiaohongshu', 'channels_wechat']) {
  const m = CHANNEL_META[p]
  assert(`[${p}] postScanBehavior 合法值`, ['redirect', 'stay_page', 'manual_confirm'].includes(m.postScanBehavior!))
  assert(`[${p}] identityRules.cookies ≥2`, m.identityRules.cookies.length >= 2)
  assert(`[${p}] extractionRules 非空`, m.identityRules.extractionRules.length > 0)
  assert(`[${p}] loginPageMarkers 非空`, m.identityRules.loginPageMarkers.length > 0)
}
assert('快手 networkApis 配置（body 无 UID + 需签名）', !!CHANNEL_META.kuaishou.identityRules.networkApis?.userApis.length)
assert('快手 metricsExtraction 配置', !!CHANNEL_META.kuaishou.metricsExtraction)

console.log('══════ L4: judgeIdentityV2 纯函数回归 ══════')
assert('cookie+identity → authenticated', judgeIdentityV2({ page: false, cookie: true, identity: true }).authenticated === true)
assert('cookie+page → authenticated', judgeIdentityV2({ page: true, cookie: true, identity: false }).authenticated === true)
assert('仅 cookie（无身份无页面）→ 不认证', judgeIdentityV2({ page: false, cookie: true, identity: false }).authenticated === false)
assert('登录页 + cookie → 不认证（credential=false）', judgeIdentityV2({ page: false, cookie: true, identity: true, loginPage: true }).authenticated === false)
assert('仅 page（无 cookie）→ 不认证', judgeIdentityV2({ page: true, cookie: false, identity: false }).authenticated === false)
assert('全信号 → authenticated + credential', judgeIdentityV2({ page: true, cookie: true, identity: true }).authenticated === true && judgeIdentityV2({ page: true, cookie: true, identity: true }).credential === true)

console.log('══════ L5: 策略驱动解析（默认值 + 通道开关语义）══════')
const defaultStrategy = { pageProbe: true, cookieProbe: true, networkCapture: false, allowReload: false }
assert('未配置 identityStrategy 的平台 → 默认 page+cookie 开 / network 关 / 不 reload', (() => {
  // 模拟 probe 内策略解析（与 probe.ts 同逻辑）
  const s = CHANNEL_META.douyin.identityStrategy ?? defaultStrategy
  return s.networkCapture === false && s.allowReload === false
})())
assert('快手 networkCapture=true（需签名平台）', CHANNEL_META.kuaishou.identityStrategy?.networkCapture === true)
assert('快手 allowReload=false（passive 模式）', CHANNEL_META.kuaishou.identityStrategy?.allowReload === false)

console.log('══════ L6: 通用指标提取器（配置驱动）══════')
import { metricsExtractorRegistry } from '../backend/src/services/enterprise/channel/metrics/platform-metrics-extractor.js'
import { BrowserMetricsExtractor } from '../backend/src/services/enterprise/channel/metrics/browser-metrics.extractor.js'
// 模拟服务启动副作用（channel-metrics.service.ts 的 registerBrowserMetricsExtractors 调用）
metricsExtractorRegistry.register(new BrowserMetricsExtractor('kuaishou'))
metricsExtractorRegistry.register(new BrowserMetricsExtractor('xiaohongshu'))
metricsExtractorRegistry.register(new BrowserMetricsExtractor('channels_wechat'))
for (const p of ['kuaishou', 'xiaohongshu', 'channels_wechat']) {
  const meta = CHANNEL_META[p]
  assert(`[${p}] metricsExtraction 配置齐全（dataUrl+rules）`, !!meta.metricsExtraction?.dataUrl && !!meta.metricsExtraction.rules.length)
  assert(`[${p}] 提取器注册（registry.has）`, metricsExtractorRegistry.has(p))
}
// 数据页判定逻辑单测（防未登录跳转页误解析空状态文案）
const kuaishouMeta = CHANNEL_META.kuaishou
assert('数据页判定：/profile 游客页 → 非数据页（exclude 命中）', (() => {
  const url = 'https://cp.kuaishou.com/profile'
  const excludeHit = kuaishouMeta.identityRules.excludeUrlPatterns?.some(re => re.test(url))
  const inWorkspace = kuaishouMeta.identityRules.urlFragments.some(f => url.includes(f))
  return excludeHit || !inWorkspace
})())
assert('数据页判定：cp.kuaishou.com/data → 数据页', (() => {
  const url = 'https://cp.kuaishou.com/data'
  const excludeHit = kuaishouMeta.identityRules.excludeUrlPatterns?.some(re => re.test(url))
  const inWorkspace = kuaishouMeta.identityRules.urlFragments.some(f => url.includes(f))
  return !excludeHit && inWorkspace
})())
assert('parseCount 万单位解析（12.3万 → 123000）', (() => {
  const { parseCount } = require('../backend/src/services/enterprise/channel/metrics/platform-metrics-extractor.js')
  return parseCount('12.3万') === 123000 && parseCount('5678') === 5678
})())

console.log(`\n══════ 结果: ${pass} PASS / ${fail} FAIL ══════`)
process.exit(fail ? 1 : 0)
