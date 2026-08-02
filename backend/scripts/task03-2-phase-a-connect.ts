/**
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A — 真实账号连接（扫码准备）
 * 1. 创建测试企业 ChannelAccount（PENDING）
 * 2. connect → headless 打开 creator.douyin.com
 * 3. 截图登录页（二维码）→ 供掌柜扫码
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { prisma } from '../src/utils/index.js'

async function main() {
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))

  // 清理历史 phase-a 账号
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

  if (result.status === 'waiting_login' && result.sessionId) {
    // 等待二维码渲染稳定后截图
    await new Promise(r => setTimeout(r, 6000))
    const status = await browserRuntime.getStatus(result.sessionId)
    console.log('SESSION_ID:', result.sessionId)
    console.log('SCREENSHOT:', status.screenshot)
    console.log('TITLE:', status.title?.slice(0, 60))
    console.log('URL:', status.currentUrl?.slice(0, 80))
    console.log('ACCOUNT_ID_FOR_QR:', account.id)
  }
  process.exit(0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })
