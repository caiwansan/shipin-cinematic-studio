/**
 * SPRINT-ECO-10.1 — Plugin Center Navigation Reality Gate
 * 掌柜批准 2026-08-04：只做导航和入口展示。
 * G1 导航链路 / → 插件中心 → 200
 * G2 插件页正常加载（发现/详情/安装链路仍在）
 * G3 原工作台零影响（短剧/小说/招聘/法律/GEO/商城/音乐/广告/新媒体 路由全 200）
 * G4 商业边界（页面无 购买/支付/提现/推广/分佣）
 * G5 License 链路（安装 → License ACTIVE → KAOR 运行检查）
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const API = 'http://127.0.0.1:4002'
const FRONT = 'http://127.0.0.1:3000'
const PG = process.env.DATABASE_URL || 'postgresql://postgres:BpgOMgBXybiNjnbyMCKCpPqh@localhost:5432/aigc_scs'

let pass = 0
let fail = 0
const failures = []

function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function api(path, method = 'GET', body, token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return r.json()
}

const q = (sql) => execSync(`psql "${PG}" -t -A -c "${sql}"`, { encoding: 'utf8' }).trim()

async function main() {
  console.log('════════ ECO-10.1 Reality Gate: Plugin Center Navigation ════════')

  // ── G1 导航链路 ──
  console.log('\n[G1] 导航链路');
  const nav = fs.readFileSync('/root/shipin-cinematic-studio/frontend/config/navigation.ts', 'utf8')
  const order = nav.match(/label: '([^']+)'/g)?.map(s => s.replace(/label: '/, '').replace(/'$/, '')) || []
  const idx = { 商城: order.indexOf('商城'), 社区: order.indexOf('社区'), 应用中心: order.indexOf('应用中心'), 插件中心: order.indexOf('插件中心'), AI中心: order.indexOf('AI中心') }
  check('primaryNav 含插件中心', idx.插件中心 >= 0)
  check('插件中心在应用中心之后', idx.插件中心 > idx.应用中心, `应用中心@${idx.应用中心} 插件中心@${idx.插件中心}`)
  check('插件中心在 AI中心之前', idx.插件中心 < idx.AI中心, `插件中心@${idx.插件中心} AI中心@${idx.AI中心}`)
  check('插件中心在社区之后', idx.插件中心 > idx.社区, `社区@${idx.社区}`)
  const home = await fetch(`${FRONT}/`).catch(() => null)
  check('首页可达 200', home?.status === 200, `status=${home?.status}`)
  const plugins = await fetch(`${FRONT}/ecosystem/plugins`).catch(() => null)
  check('插件中心路由可达 200', plugins?.status === 200, `status=${plugins?.status}`)

  // ── G2 插件页 API 链路 ──
  console.log('\n[G2] 插件页加载');
  const loginG2 = await api('/api/auth/login', 'POST', { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' })
  const tokenG2 = loginG2.accessToken || loginG2.data?.accessToken
  const items = await api('/api/ecosystem/marketplace/items', 'GET', undefined, tokenG2)
  check('列表 API 正常', items.code === 0, `code=${items.code}`)
  const listed = (items.data?.items || []).filter((i) => i.status === 'LISTED')
  check('官方插件 LISTED ≥ 1', listed.length >= 1, `count=${listed.length}`)
  check('列表含价格字段（无商城逻辑仍展示）', (items.data?.items || []).some((i) => typeof i.price !== 'undefined'))

  // ── G3 原工作台回归 ──
  console.log('\n[G3] 原工作台零影响');
  const routes = ['/studio/v2', '/hdz', '/workspace/recruitment', '/workspace/legal', '/workspace/geo/dashboard', '/mall', '/workspace/music', '/workspace/ad-create', '/workspace/media']
  for (const r of routes) {
    const res = await fetch(`${FRONT}${r}`).catch(() => null)
    check(`路由 ${r} 200`, res?.status === 200, `status=${res?.status}`)
  }

  // ── G4 商业边界 ──
  console.log('\n[G4] 商业边界（禁商城交易）');
  const page = fs.readFileSync('/root/shipin-cinematic-studio/frontend/pages/ecosystem/plugins.vue', 'utf8')
  const nav2 = fs.readFileSync('/root/shipin-cinematic-studio/frontend/config/navigation.ts', 'utf8')
  // 剥离代码注释（禁止清单注释会误报），只检查实际渲染/逻辑文本
  const pageBody = page.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const banned = ['购买', '立即购买', '购物车', '去支付', '钱包', '提现', '推广', '分佣', '排行榜', '推荐算法']
  for (const b of banned) {
    check(`页面无「${b}」`, !pageBody.includes(b) && !nav2.includes(b))
  }
  check('页面标题 = 昆仑镜 AI 插件中心', pageBody.includes('昆仑镜 AI 插件中心'))
  check('副标题 = 发现、安装和管理…', pageBody.includes('发现、安装和管理 AI 员工与智能工作流插件'))
  check('未命名「插件商城」', !pageBody.includes('插件商城') && !nav2.includes('插件商城'))

  // ── G5 License 链路（安装 → ACTIVE → 运行检查） ──
  console.log('\n[G5] License 链路不变');
  const login = await api('/api/auth/login', 'POST', { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' })
  const loginOk = !!login.accessToken || !!login.data?.accessToken
  check('测试账号登录', loginOk)
  const token = login.accessToken || login.data?.accessToken
  const install = await api('/api/ecosystem/marketplace/install', 'POST', { pluginId: 'ai-viral-analyst' }, token)
  check('安装 → INSTALLED', install.code === 0 && install.data?.install?.status === 'INSTALLED', install.data?.install?.status)
  check('License ACTIVE', install.data?.license?.status === 'ACTIVE', `${install.data?.license?.status}/${install.data?.license?.licenseType}`)
  const licDb = q(`SELECT count(*) FROM ecology_licenses WHERE status='ACTIVE'`)
  check('License 落库', Number(licDb) >= 1, `count=${licDb}`)
  const run = await api('/api/ecosystem/marketplace/launch-check', 'POST', { pluginId: 'ai-viral-analyst' }, token)
  check('KAOR 运行检查 allowed', run.code === 0 && run.data?.allowed === true, JSON.stringify(run.data))

  console.log(`\n════════ ECO-10.1 Reality Gate: ${pass} PASS / ${fail} FAIL ════════`)
  if (fail > 0) { console.log('失败项:', failures.join(' | ')); process.exit(1) }
}

main().catch(e => { console.error(e); process.exit(1) })
