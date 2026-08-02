/**
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A — 真实抖音账号扫码登录（长驻进程）
 * 1. 创建测试企业 ChannelAccount（PENDING）
 * 2. connect → headless 打开 creator.douyin.com → waiting_login
 * 3. 截图二维码（每 25s 刷新覆盖 /tmp/browser-sessions/phase-a-qr.png）
 * 4. 轮询登录态（不刷新页面）→ 登录成功 → refresh-credential AES 回写 → 打印结果
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { prisma } from '../src/utils/index.js'
import * as fs from 'fs'

process.on('unhandledRejection', (e: any) => { console.error('UNHANDLED_REJECTION:', e?.stack || e); process.exit(1) })
process.on('uncaughtException', (e: any) => { console.error('UNCAUGHT:', e?.stack || e); process.exit(1) })

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))

  const stale = await prisma.enterpriseChannelAccount.findMany({ where: { externalAccountId: { startsWith: 'phase-a-' } }, select: { id: true } })
  if (stale.length) await prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: stale.map(x => x.id) } } })

  const account = await channelService.connectAccount({
    tenantId: 'phase-a',
    platform: 'douyin',
    accountName: 'PhaseA 真实连接测试号',
    externalAccountId: 'phase-a-' + Date.now(),
    credential: { cookieData: '[]' },
  })
  console.log('ACCOUNT_ID:', account.id)

  const result = await channelService.connectChannel(account.id)
  console.log('CONNECT_STATUS:', result.status)
  if (result.status !== 'waiting_login' || !result.sessionId) {
    console.log('UNEXPECTED_CONNECT:', JSON.stringify(result))
    process.exit(1)
  }
  const sessionId = result.sessionId

  // DOM 诊断：二维码是否真实渲染（img/canvas/文本）
  await sleep(4000)
  const domDiag = await browserRuntime.withPage(sessionId, async (page) => {
    const qrImgs = await page.$$eval('img', imgs => imgs.map(i => ({ src: (i.src || '').slice(0, 100), w: i.width, h: i.height, vis: !!(i.offsetWidth || i.offsetHeight) })).filter(i => /qr|code|login|scan|passport/i.test(i.src) || (i.w > 60 && i.h > 60)))
    const canvases = await page.$$eval('canvas', cs => cs.map(c => ({ w: c.width, h: c.height, vis: !!(c.offsetWidth || c.offsetHeight) })))
    const bodyText = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ').slice(0, 300))
    return { qrImgs, canvases, bodyText }
  })
  console.log('DOM_DIAG:', JSON.stringify(domDiag))

  // 首次截图（覆盖固定路径）
  await sleep(5000)
  try {
    const shot = await browserRuntime.getStatus(sessionId)
    if (shot.screenshot) {
      fs.copyFileSync(shot.screenshot, '/tmp/browser-sessions/phase-a-qr.png')
      console.log('QR_SCREENSHOT_READY: /tmp/browser-sessions/phase-a-qr.png')
    } else {
      console.log('QR_SCREENSHOT_FAIL: 浏览器暂不可用（等待自动恢复）')
    }
  } catch (e: any) {
    console.log('QR_SCREENSHOT_FAIL:', e.message)
  }

  // 后台截图刷新循环（二维码定期刷新）+ 前台等待登录
  let done = false
  const screenshotLoop = (async () => {
    while (!done) {
      // 二维码 2 分钟一换（抖音码有效期约 2-3 分钟），给掌柜充足扫码窗口
    await sleep(120000)
      try {
        const s = await browserRuntime.getStatus(sessionId)
        if (s.screenshot) fs.copyFileSync(s.screenshot, '/tmp/browser-sessions/phase-a-qr.png')
        console.log('QR_REFRESHED')
      } catch (e: any) {
        console.log('QR_REFRESH_FAIL:', e.message)
      }
    }
  })()

  console.log('WAITING_FOR_SCAN...')
  const loginResult = await channelService.waitChannelLogin(account.id, 30 * 60 * 1000)
  done = true
  console.log('LOGIN_RESULT:', JSON.stringify(loginResult).slice(0, 120))

  if (loginResult.status === 'connected') {
    // 登录成功 → 凭证回写（AES 加密落库）
    const refresh = await channelService.refreshChannelCredential(account.id)
    console.log('CREDENTIAL_REFRESH:', JSON.stringify(refresh))
    const db = await prisma.enterpriseChannelAccount.findUnique({ where: { id: account.id } })
    console.log('DB_STATUS:', db?.connectionStatus, '| connectedAt:', db?.connectedAt, '| hasCredential:', !!db?.credentialEncrypted)
    console.log('PHASE_A_SUCCESS')
  } else {
    console.log('PHASE_A_TIMEOUT')
  }
  process.exit(0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })
