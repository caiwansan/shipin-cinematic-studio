/**
 * S6.5 Windows Production Reality — 云侧就绪验证（RG-W 手册的 Cloud 依赖链）
 * 验证: Windows 首启登录后依赖的所有 Cloud 链路可用
 * （RG-W 实机步骤 = Windows 开发机执行, 见手册）
 */
import { executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const USER_A = process.env.TENANT_A_USER || ''

console.log('══ S6.5 Windows Production — Cloud 就绪验证 ══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// RG-W4: 登录链（Desktop 登录 → JWT）
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const H = { Authorization: `Bearer ${login.accessToken}` }
check('W4 登录链（Desktop 首启登录）', !!login.accessToken, 'jwt ok')

// RG-W5: AI Employee 发现链
const cat = await fetch(`${API}/api/skills/mapping/agent-definitions`).then(r => r.json()).catch(() => null)
const codes = (cat?.data?.defs || []).filter((d: any) => d.status === 'active').map((d: any) => d.code)
check('W5 AI Employee 发现（三员工）', ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops'].every((c) => codes.includes(c)), codes.length)
const ent = await fetch(`${API}/api/skills/employees/def-recruiter-alice/entitlement`, { headers: H }).then(r => r.json()).catch(() => null)
check('W5 商品卡授权态（entitlement）', ent?.data?.entitlementState === 'ACTIVE', ent?.data?.entitlementState)

// RG-W6: Workspace 启动依赖（工作台页存在 + 前端主站可达）
import { existsSync } from 'node:fs'
const wsPages = ['/root/shipin-cinematic-studio/frontend/pages/workspace/recruitment', '/root/shipin-cinematic-studio/frontend/pages/hdz/workspace', '/root/shipin-cinematic-studio/frontend/pages/media-department']
check('W6 员工工作台页存在（启动目标）', wsPages.every((p) => existsSync(p)), wsPages)
const fe = await fetch('http://127.0.0.1:3000/').then(r => r.status).catch(() => 0)
check('W6 前端主站可达（工作台宿主）', fe === 200, fe)

// W6 执行链（Desktop 启动 → Cloud 执行）
const run = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-candidate-scorer', tool: 'candidate.score', input: { resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: '互联网研发岗', tenantUserId: USER_A } }],
}).catch(() => null)
check('W6 启动后执行链 COMPLETED（含插件增强）', run?.plan?.status === 'COMPLETED', run?.plan?.status)

// 打包卫生（bundle.exclude 生效配置）
import { readFileSync } from 'node:fs'
const conf = readFileSync('/root/shipin-cinematic-studio/desktop/src-tauri/tauri.conf.json', 'utf-8')
check('打包卫生: bundle.exclude 排除 *.bak', conf.includes('"exclude"') && conf.includes('*.bak'), 'exclude configured')

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
