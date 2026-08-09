import { chromium } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext()
const p = await ctx.newPage()
const r = await p.request.post(BASE + '/api/auth/login', { data: { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' } })
const j = await r.json()
const tok = j.accessToken
// 1) 拉公共频道成员（触发后端回填）
const m1 = await p.request.get(BASE + '/api/im/channels/kl_public_tea/members?type=4', { headers: { Authorization: 'Bearer ' + tok } })
const jm = await m1.json()
const me = jm.data?.members?.find(x => x.uid === 'u_ten_org_test')
console.log('成员接口返回(uid=测试账号):', me ? `name=${me.name}` : '未找到（uid 可能不同，列出前3个成员名）')
if (!me) console.log('成员样例:', jm.data?.members?.slice(0,3).map(m=>`${m.uid.slice(0,8)}→${m.name}`).join(' | '))
await browser.close()
