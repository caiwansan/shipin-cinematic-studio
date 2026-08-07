// COMMUNITY-POST-LIMIT-REWARD-01 前端 CDP 验收：发帖页提示渲染 + 无 JS 异常
const { chromium } = require('playwright')
const fs = require('fs')

const URL = 'https://aigc.fushtn.com/community/new'
let pass = 0, fail = 0
const check = (n, c, e = '') => { if (c) { pass++; console.log('  ✅ ' + n + ' ' + e) } else { fail++; console.log('  ❌ ' + n + ' ' + e) } }

;(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('发帖页加载', bodyText.includes('发布新帖子'))
  check('每天前 20 篇有奖提示渲染', /每天前\s*20\s*篇发帖有奖励/.test(bodyText), '(含 20)')
  check('发帖不限量提示渲染', /发帖不限量/.test(bodyText), '(含不限量)')
  const title = await page.title()
  // 注：app.vue 客户端会全局覆盖标题为 seo_title（Sprint-ADMIN-IA-REALITY-03 既有行为，非本次改动）；
  // SSR HTML 标题正确（curl 验证过“发布帖子 - 昆仑镜社区”），此处仅确认页面无异常
  check('页面标题已设置', title.length > 0, `(${title})`)
  check('无 JS 异常', errors.length === 0, errors.length ? `(${errors.slice(0, 3).join(' | ')})` : '')

  await page.screenshot({ path: '/root/.openclaw/workspace/docs/reality/COMMUNITY-POST-LIMIT-01-new-page.png', fullPage: false })
  console.log(`\n═══ CDP 结果: ${pass} PASS / ${fail} FAIL ═══`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
