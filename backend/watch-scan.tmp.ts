import { browserRuntime } from './src/services/media/browser-runtime.service.js'
const sid = 'kuaishou:10e0ea29-3a20-4aae-9efc-8557b86daa0c'
const start = Date.now()
async function snapshot(i: number) {
  try {
    const st = await browserRuntime.withPage(sid, async (page) => {
      const url = page.url()
      const cookies = await page.context().cookies()
      const byName: Record<string, string> = {}
      for (const c of cookies) byName[c.name] = c.value.length > 12 ? c.value.slice(0, 12) + '...' : c.value
      const hasBUserId = !!byName['bUserId']
      const hasKws = !!byName['kwssectoken']
      const passport = url.includes('passport')
      const cp = url.includes('cp.kuaishou.com') && !passport
      return { url: url.slice(0, 90), bUserId: hasBUserId, kwssectoken: hasKws, passport, cp }
    }, 'https://cp.kuaishou.com/article')
    const elapsed = Math.round((Date.now() - start) / 1000)
    const flag = st.cp ? '👑已进工作台!' : st.passport ? '登录页' : st.bUserId ? '有bUserId' : '无bUserId'
    console.log(`[${elapsed}s] ${flag} | ${st.url} | bUserId=${st.bUserId} kwssectoken=${st.kwssectoken}`)
  } catch (e: any) {
    console.log(`[${Math.round((Date.now() - start) / 1000)}s] ERR ${e.message.slice(0, 60)}`)
  }
}
for (let i = 0; i < 240; i++) {
  await snapshot(i)
  await new Promise(r => setTimeout(r, 5000))
}
process.exit(0)
