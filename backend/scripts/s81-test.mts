/**
 * S8.1 Desktop Experience — Reality Gate（UX0-UX8）
 * UX0 首屏认知（首页结构/欢迎语/员工卡数据源） / UX1 色彩令牌 / UX2 组件
 * UX3 员工档案式 / UX4 Marketplace 视觉 / UX5 Enterprise 视觉 / UX6 动效克制
 * UX7 商品理解（雇佣非工具表达）/ UX8 品牌一致性 + 回归
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

console.log('══ S8.1 Desktop Experience Reality Gate（UX0-UX8）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)
const ui = readFileSync(UI, 'utf-8')

// ── UX0: 首屏认知（首页 = 默认落地 + 欢迎语 + 员工卡数据源）──
console.log('\n── UX0: 首屏认知 ──')
check('UX0 首页为默认落地（nav 首项 home）', /data-view="home"[\s\S]*?data-view="apps"/.test(ui), 'home first')
check('UX0 欢迎语「你的 AI 团队今天准备好了」', ui.includes('你的 AI 团队今天准备好了'), 'greeting')
check('UX0 员工状态卡由 Marketplace API 驱动', ui.includes("api('/api/marketplace/employees')") && ui.includes('home-employees'), 'data-driven')
check('UX0 晨雾青山背景（SVG 山形 + 天青渐变）', ui.includes('class="mountains"') && ui.includes('DCE8E4'), 'hero')
const loginRes = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }) }).then(r => r.json())
const H = { Authorization: `Bearer ${loginRes.accessToken}` }
const mkt = await fetch(`${API}/api/marketplace/employees`, { headers: H }).then(r => r.json()).catch(() => null)
check('UX0 首页数据源真实（5 员工 + 岗位表达）', (mkt?.data?.employees || []).length === 5 && (mkt?.data?.employees || []).every((e: any) => !!e.identity?.title), (mkt?.data?.employees || []).length)

// ── UX1: 色彩令牌 ──
console.log('\n── UX1: 色彩令牌 ──')
for (const c of ['#7BA7A3', '#24527A', '#F7F5EF', '#C8A951']) {
  check(`UX1 令牌色 ${c} 存在`, ui.includes(c), c)
}

// ── UX2: 组件系统 ──
console.log('\n── UX2: 组件 ──')
check('UX2 印章式徽章（.seal）', ui.includes('.badge.seal'), 'seal badge')
check('UX2 状态点呼吸动效（kl-breathe）', ui.includes('kl-breathe'), 'breathe')
check('UX2 细线卡片/圆角令牌', ui.includes('--kl-line') && ui.includes('--radius'), 'tokens')

// ── UX3: 员工档案式 ──
console.log('\n── UX3: 员工档案 ──')
check('UX3 详情页 Landing 价值表达优先', ui.includes('mkt.landing') && ui.includes('l.positioning'), 'landing-first')
check('UX3 员工卡非工具按钮式（含今日完成/最近成果语义）', ui.includes('今日任务') && ui.includes('最近成果'), 'profile-like')

// ── UX4: Marketplace 视觉 ──
console.log('\n── UX4: Marketplace ──')
check('UX4 分类 tab + 搜索保留（视觉升级未破坏逻辑）', ui.includes('data-mkt-cat') && ui.includes('mkt-search'), 'mkt intact')

// ── UX5: Enterprise 视觉 ──
console.log('\n── UX5: Enterprise Center ──')
check('UX5 企业管理视图保留', ui.includes('page-enterprise') && ui.includes('refreshEnterprise'), 'enterprise intact')

// ── UX6: 动效克制 ──
console.log('\n── UX6: 动效 ──')
check('UX6 无夸张动效（无 bounce/jelly/keyframes 滥用）', !/animation:.*(bounce|jelly|shake)/.test(ui), 'restrained')
check('UX6 尊重 reduced-motion', ui.includes('prefers-reduced-motion'), 'reduced-motion')

// ── UX7: 商品理解（雇佣非工具）──
console.log('\n── UX7: 商品理解 ──')
const cat = await fetch(`${API}/api/marketplace/employees/def-recruiter-alice`).then(r => r.json()).catch(() => null)
check('UX7 Landing 表达雇佣语义（24 小时招聘经理, 非「简历工具」）', (cat?.data?.landing?.positioning || '').includes('招聘经理') && !(cat?.data?.identity?.title || '').includes('工具'), cat?.data?.landing?.positioning)

// ── UX8: 品牌一致性 + 回归 ──
console.log('\n── UX8: 品牌一致性 + 回归 ──')
const darkResidue = /#0e0f1a|#16182b|#1d2038/.test(ui)
check('UX8 旧暗色主题零残留', !darkResidue, 'no dark residue')
const r = await executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null)
check('UX8 执行链回归 COMPLETED（视觉重构零破坏）', r?.plan?.status === 'COMPLETED', r?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
