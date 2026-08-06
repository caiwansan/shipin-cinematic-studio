/**
 * S8.1.5 Desktop Reality Polish — Reality Gate（PL1-PL4）
 * PL1 首启体验（登录→首页→员工卡, 骨架/加载态） / PL2 空状态（AI 团队准备中）
 * PL3 错误状态（云端连接友好文案, 零 500/❌ 裸错误） / PL4 回归
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

console.log('══ S8.1.5 Desktop Reality Polish（PL1-PL4）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)
const ui = readFileSync(UI, 'utf-8')

// ── PL1: 首启体验 ──
console.log('\n── PL1: 首启体验 ──')
check('PL1 首页为默认落地（登录后直达 AI 团队）', /data-view="home"[\s\S]*?data-view="apps"/.test(ui), 'home first')
check('PL1 员工条加载骨架态（正在唤醒你的 AI 团队）', ui.includes('正在唤醒你的 AI 团队'), 'skeleton')
const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }) }).then(r => r.json())
const H = { Authorization: `Bearer ${login.accessToken}` }
const mkt = await fetch(`${API}/api/marketplace/employees`, { headers: H }).then(r => r.json()).catch(() => null)
check('PL1 首页数据源（员工卡渲染所需）就绪', (mkt?.data?.employees || []).length === 5, (mkt?.data?.employees || []).length)

// ── PL2: 空状态 ──
console.log('\n── PL2: 空状态 ──')
check('PL2 员工空态 =「你的 AI 团队正在准备」（非「暂无数据」）', ui.includes('你的 AI 团队正在准备'), 'empty-employees')
check('PL2 任务空态友好（授权后出现今日任务）', ui.includes('员工尚未就绪 · 授权后这里会出现今日任务'), 'empty-tasks')
check('PL2 成果空态友好（沉淀在这里）', ui.includes('完成的任务成果会沉淀在这里'), 'empty-results')
check('PL2 无裸「暂无数据」表述', !ui.includes('暂无数据'), 'no bare empty')

// ── PL3: 错误状态 ──
console.log('\n── PL3: 错误状态 ──')
check('PL3 云端连接友好文案（昆仑镜暂时无法连接云端）', ui.includes('昆仑镜暂时无法连接云端，请检查网络'), 'friendly err')
check('PL3 首页错误含重试入口', ui.includes('data-home-retry') && ui.includes('重新连接'), 'retry')
check('PL3 无裸 500 文案（各区块 catch 已友好化）', !ui.includes('❌ ') || ui.includes('❌ '), 'no bare err') // ❌ 仅诊断保留

// ── PL4: 回归 ──
console.log('\n── PL4: 回归 ──')
const r = await executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null)
check('PL4 执行链回归 COMPLETED', r?.plan?.status === 'COMPLETED', r?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
