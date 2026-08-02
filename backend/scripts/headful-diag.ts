/** 诊断：headful navigate 的真实结果 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { prisma } from '../src/utils/index.js'

async function main() {
  const stale = await prisma.enterpriseChannelAccount.findMany({ where: { externalAccountId: { startsWith: 'phase-a-' } }, select: { id: true } })
  if (stale.length) await prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: stale.map(x => x.id) } } })
  const acct = await prisma.enterpriseChannelAccount.create({
    data: {
      tenantId: 'phase-a', channelType: 'douyin',
      channelName: '抖音诊断号', externalAccountId: 'phase-a-' + Date.now(),
      credentialEncrypted: { cipher: 'aes-256-gcm', payload: '{}' } as any,
      ownerId: 'phase-a-owner',
      connectionStatus: 'pending',
    },
  })
  const sid = 'douyin:' + acct.id
  console.log('NAVIGATE (headful)...')
  const nav = await browserRuntime.navigate(sid, 'https://creator.douyin.com/', { headless: false })
  console.log('NAV_RESULT:', JSON.stringify(nav))
  await new Promise(r => setTimeout(r, 4000))
  const dom = await browserRuntime.withPage(sid, async (page) => {
    const url = page.url()
    const body = await page.locator('body').innerText().catch(() => 'ERR')
    return { url, body: body.replace(/\n+/g, '|').slice(0, 200), imgs: await page.locator('img').count().catch(() => -1), canvases: await page.locator('canvas').count().catch(() => -1) }
  })
  console.log('DOM:', JSON.stringify(dom))
  const st = await browserRuntime.getStatus(sid)
  console.log('STATUS:', st.currentUrl, '|', st.title)
  process.exit(0)
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
