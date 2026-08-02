/**
 * SPRINT-MEDIA-LOGIN-REALITY-FIX-01 — Detector Reality 调试脚本
 * 对指定平台真实打开登录页，跑 BrowserLoginDetector v2，输出各通道诊断。
 * 用法: npx tsx scripts/detector-reality-test.ts xiaohongshu|kuaishou|channels_wechat|douyin
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { loginDetector } from '../src/enterprise/channel/adapters/login-detector.js'
import { CHANNEL_META } from '../src/enterprise/channel/adapters/browser-channel.meta.js'

const platform = process.argv[2] || 'xiaohongshu'
const meta = CHANNEL_META[platform]
if (!meta) { console.error('未知平台', platform); process.exit(1) }

const rt = browserRuntime
const sid = `detector-test-${platform}-${Date.now()}`
console.log(`\n===== ${meta.displayName} Detector Reality Test =====`)
console.log(`loginUrl: ${meta.loginUrl}\n`)

const nav = await rt.navigate(sid, meta.loginUrl, { headless: false })
console.log(`navigate: ${nav.success ? 'OK' : 'FAIL ' + nav.error} → ${nav.url || ''}`)
await new Promise(r => setTimeout(r, 6000))

// 登录入口确认（Task03/04 同款逻辑）
if (meta.loginEntry) {
  const cur = await rt.withPage(sid, async (p) => p.url()).catch(() => '')
  console.log(`[loginEntry] mustMatch=${meta.loginEntry.mustMatch} | cur=${cur}`)
  if (cur && !meta.loginEntry.mustMatch.test(cur)) {
    console.log(`  → 未命中登录入口，回退 ${meta.loginEntry.fallbackUrl}`)
    await rt.navigate(sid, meta.loginEntry.fallbackUrl!, { headless: false })
    await new Promise(r => setTimeout(r, 3000))
  } else {
    console.log(`  → 登录入口确认 ✅`)
  }
}

const det = await rt.withPage(sid, async (page) => {
  const res = await loginDetector.detect(page)
  const text = await loginDetector.pageTextSample(page)
  return { res, text, url: page.url(), frames: page.frames().length }
}).catch(e => ({ error: e.message }))

if ((det as any).error) {
  console.log('detector 异常:', (det as any).error)
  process.exit(1)
}

const { res, text, url, frames } = det as any
console.log(`\nURL: ${url}`)
console.log(`Frames: ${frames}`)
console.log(`PageText: ${text}`)
console.log(`\nQR Detector 通道:`)
console.log(`  img       ${res.channels.img.found ? '✅' : '❌'} (count=${res.channels.img.count}) ${res.channels.img.note || ''}`)
console.log(`  canvas    ${res.channels.canvas.found ? '✅' : '❌'} (count=${res.channels.canvas.count}) ${res.channels.canvas.note || ''}`)
console.log(`  iframe    ${res.channels.iframe.found ? '✅' : '❌'} (count=${res.channels.iframe.count}, frames=${res.channels.iframe.frames}) ${res.channels.iframe.note || ''}`)
console.log(`  screenshot ${res.channels.screenshot.found ? '✅' : '❌'} (scanned=${res.channels.screenshot.scanned}) ${res.channels.screenshot.note || ''}`)
console.log(`\n结果: source=${res.source} | qrCode=${res.qrCode ? res.qrCode.slice(0, 30) + '...' + `(${Math.round(res.qrCode.length / 1024)}KB)` : '无'} | loginMethod=${res.loginMethod}`)

// 保存截图供人工确认
const st = await rt.getStatus(sid).catch(() => null)
if (st?.screenshot) {
  const fs = await import('fs')
  const out = `/root/shipin-cinematic-studio/docs/reality/LOGIN-FIX-01-${platform}.png`
  fs.copyFileSync(st.screenshot, out)
  console.log(`截图: ${out}`)
}
await rt.destroyWorkspace(sid).catch(() => {})
console.log('DONE')
