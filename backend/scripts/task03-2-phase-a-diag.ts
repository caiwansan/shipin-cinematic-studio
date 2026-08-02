/** 诊断抖音登录页 DOM：是否渲染二维码 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { prisma } from '../src/utils/index.js'

async function main() {
  const acct = await prisma.enterpriseChannelAccount.findFirst({ where: { externalAccountId: { startsWith: 'phase-a-' } } })
  if (!acct) { console.log('NO_ACCOUNT'); process.exit(1) }
  const sid = 'douyin:' + acct.id
  console.log('SESSION:', sid)

  const info = await browserRuntime.getStatus(sid)
  console.log('URL:', info.currentUrl)
  console.log('TITLE:', info.title)

  const dom = await browserRuntime.withPage(sid, async (page) => {
    const qrImgs = await page.$$eval('img', imgs => imgs.map(i => ({ src: (i.src || '').slice(0, 120), w: i.width, h: i.height, visible: !!(i.offsetWidth || i.offsetHeight) })).filter(i => /qr|code|login|scan/i.test(i.src) || (i.w > 50 && i.h > 50)))
    const canvases = await page.$$eval('canvas', cs => cs.map(c => ({ w: c.width, h: c.height, visible: !!(c.offsetWidth || c.offsetHeight) })))
    const qrTexts = await page.evaluate(() => {
      const bodyText = document.body?.innerText || ''
      return {
        hasScanText: /扫码|扫一扫|打开抖音/i.test(bodyText),
        snippet: bodyText.replace(/\n+/g, ' | ').slice(0, 400),
      }
    })
    const iframes = await page.$$eval('iframe', fs => fs.map(f => (f.src || '').slice(0, 120)))
    return { qrImgs, canvases, qrTexts, iframes }
  })
  console.log('QR_IMGS:', JSON.stringify(dom.qrImgs, null, 1))
  console.log('CANVASES:', JSON.stringify(dom.canvases))
  console.log('TEXT:', JSON.stringify(dom.qrTexts))
  console.log('IFRAMES:', JSON.stringify(dom.iframes))
  process.exit(0)
}
main().catch(e => { console.error('DIAG_ERROR:', e.message); process.exit(1) })
