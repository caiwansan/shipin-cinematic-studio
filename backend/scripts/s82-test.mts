/**
 * S8.2 Desktop Product Experience — Reality Gate（PX1-PX9）
 * PX1 欢迎引导 / PX2 员工档案 / PX3 Command Center / PX4 壳层边界
 * PX5 品牌一致 / PX6 回归 / PX7 第一分钟 / PX8 员工价值（用户语言） / PX9 品牌一致性
 */
import { readFileSync } from 'node:fs'
import { executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const USER_A = process.env.TENANT_A_USER || ''
const UI = '/root/shipin-cinematic-studio/desktop/ui/index.html'

console.log('══ S8.2 Desktop Product Experience Reality Gate（PX1-PX9）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)
const ui = readFileSync(UI, 'utf-8')

// ── PX1: 欢迎引导 ──
console.log('\n── PX1: Welcome Experience ──')
check('PX1 欢迎层存在（欢迎来到昆仑镜 + AI 团队已准备好）', ui.includes('欢迎来到昆仑镜') && ui.includes('你的企业 AI 团队已经准备好'), 'welcome')
check('PX1 首次登录触发 + localStorage 记忆', ui.includes("localStorage.getItem('kl_welcomed')") && ui.includes("setItem('kl_welcomed'"), 'remembered')
check('PX1 欢迎层员工数据 = Marketplace API', ui.includes('welcome-grid') && ui.includes("api('/api/marketplace/employees')"), 'data-driven')

// ── PX2: 员工档案 ──
console.log('\n── PX2: Employee Profile ──')
check('PX2 档案含「安排任务」动作（启动工作台）', ui.includes('安排任务') || ui.includes('进入工作台'), 'assign action')
check('PX2 档案含状态/负责/成果语义', ui.includes('负责:') && ui.includes('最近成果') && ui.includes('状态'), 'profile semantics')

// ── PX3: Command Center ──
console.log('\n── PX3: Command Center ──')
check('PX3 Ctrl+Space 唤起（keydown + Space）', ui.includes('e.code === \'Space\'') && ui.includes('ctrlKey'), 'hotkey')
check('PX3 搜索员工真实（marketplace q 过滤）', ui.includes('/api/marketplace/employees?q=') && ui.includes('encodeURIComponent(q)'), 'search')
check('PX3 导航直达（商城/企业管理/设备）', ui.includes("'应用商城'") && ui.includes("'企业管理'"), 'nav actions')
check('PX3 无 AI 问答（纯入口层）', !ui.includes('问 AI') && !ui.includes('chat') && !ui.includes('assistant('), 'no chat')

// ── PX4: 壳层边界 ──
console.log('\n── PX4: 壳层边界 ──')
const apiRefs = ui.match(/api\(['"]\/api\/[a-z-]+/g) || []
const knownPrefix = ['/api/marketplace', '/api/skills', '/api/ecosystem', '/api/admin', '/api/auth']
const unknown = apiRefs.filter((u) => !knownPrefix.some((k) => u.includes(k)))
check('PX4 零新后端 API（全部引用为已知端点）', unknown.length === 0, unknown.slice(0, 3))
check('PX4 无 Nuxt/工作台业务触碰标记', !ui.includes('nuxt') && !ui.includes('_nuxt'), 'no nuxt')

// ── PX5/PX9: 品牌一致 ──
console.log('\n── PX5/PX9: 品牌一致性 ──')
for (const c of ['#7BA7A3', '#24527A', '#F7F5EF', '#C8A951']) {
  check(`PX9 令牌色 ${c} 保持`, ui.includes(c), c)
}
check('PX9 无科技蓝渐变/AI 紫/霓虹赛博风', !/#4F46E5|#8B5CF6|#00FFFF|#FF00FF/.test(ui), 'no tech-blue/ai-purple/neon')
check('PX9 无机器人元素', !ui.includes('🤖') && !ui.includes('robot'), 'no robot')

// ── PX6: 回归 ──
console.log('\n── PX6: 回归 ──')
const r = await executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null)
check('PX6 执行链回归 COMPLETED', r?.plan?.status === 'COMPLETED', r?.plan?.status)
const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }) }).then(r => r.json())
check('PX6 登录链正常', !!login.accessToken, 'jwt ok')

// ── PX7: 第一分钟 ──
console.log('\n── PX7: 第一分钟 ──')
check('PX7 欢迎文案回答「昆仑镜是什么」（我的 AI 员工团队）', ui.includes('你的企业 AI 团队') && ui.includes('你的 AI 团队今天准备好了'), 'first-minute story')

// ── PX8: 员工价值（用户语言, 主视图禁系统语言）──
console.log('\n── PX8: 员工价值 ──')
const detail = await fetch(`${API}/api/marketplace/employees/def-recruiter-alice`).then(r => r.json()).catch(() => null)
check('PX8 档案主数据 = 用户语言（定位/适合/负责, 非系统语言）', !!detail?.data?.landing?.positioning && (detail?.data?.landing?.responsibilities || []).length >= 3 && !(detail?.data?.identity?.title || '').includes('工具'), detail?.data?.landing)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
