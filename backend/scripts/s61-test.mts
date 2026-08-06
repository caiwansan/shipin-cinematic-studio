/**
 * S6.1 Desktop Product UI — Reality Gate（DP1'-DP6'）
 * DP1' 商品入口（三员工可发现）/ DP2' 详情数据源 / DP3' 增强展示（授权显/未授权隐）
 * DP4' Usage 与 Cloud 一致 / DP5' Runtime 边界扫描 / DP6' 三员工同时展示
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeUsageMeter } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const ALICE = 'def-recruiter-alice'
const DIRECTOR = 'def-shortdrama-director'
const NEWMEDIA = 'def-newmedia-ops'

console.log('══ S6.1 Desktop Product UI Reality Gate（DP1\'-DP6\'）══')

// 登录 A 租户拿 JWT（Desktop 真实链路: token → JWT → API）
const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const token = loginRes.accessToken
check('前置: 登录获取 JWT', !!token, token?.slice(0, 20) + '…')
if (!token) process.exit(1)
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const A_USER = loginRes.user?.id || ''

// ── DP1': 商品入口（员工目录, Desktop 数据源）──
console.log('\n── DP1\': 商品入口 ──')
const cat = await fetch(`${API}/api/skills/mapping/agent-definitions`).then(r => r.json()).catch(() => null)
const active = (cat?.data?.defs || []).filter((d: any) => d.status === 'active')
const codes = active.map((d: any) => d.code)
check('DP1\' Desktop 可发现 Alice/短剧/新媒体 三员工', [ALICE, DIRECTOR, NEWMEDIA].every((c) => codes.includes(c)), codes)

// ── DP2': 商品详情数据源（skills/entitlement/usage/enhancements 四 API 全通）──
console.log('\n── DP2\': 商品详情数据源 ──')
const dSkills = await fetch(`${API}/api/skills/employees/${ALICE}/skills`).then(r => r.json()).catch(() => null)
check('DP2\' skills API（能力明细）', (dSkills?.data?.skills || []).length >= 1, dSkills?.data?.skills?.map((s: any) => s.id))
const dEnt = await fetch(`${API}/api/skills/employees/${ALICE}/entitlement`, { headers: H }).then(r => r.json()).catch(() => null)
check('DP2\' entitlement API（授权状态）', !!dEnt?.data?.entitlementState, dEnt?.data)
const dUsage = await fetch(`${API}/api/skills/employees/${ALICE}/usage`, { headers: H }).then(r => r.json()).catch(() => null)
check('DP2\' usage API（用量）', typeof dUsage?.data?.executions === 'number', dUsage?.data?.executions)
const dEnh = await fetch(`${API}/api/skills/employees/${ALICE}/enhancements`, { headers: H }).then(r => r.json()).catch(() => null)
check('DP2\' enhancements API（增强包）', Array.isArray(dEnh?.data?.enhancements), dEnh?.data)

// ── DP3': 增强展示（A 有授权 → 显示; B 无授权 → 隐藏/空）──
console.log('\n── DP3\': Enhancement 展示 ──')
check('DP3\' A 企业 Alice 显示 JD 模板增强', (dEnh?.data?.enhancements || []).some((e: any) => e.type === 'jd-template' && e.skillId === 'candidate.score'), dEnh?.data?.enhancements?.map((e: any) => e.type))
const loginB = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const enhB = await fetch(`${API}/api/skills/employees/${ALICE}/enhancements`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json()).catch(() => null)
check('DP3\' B 企业（无插件授权）增强为空（隐藏）', (enhB?.data?.enhancements || []).length === 0, enhB?.data)

// ── DP4': Usage 与 Cloud 一致 ──
console.log('\n── DP4\': Usage 一致性 ──')
const meterCloud = await getEmployeeUsageMeter(A_USER, ALICE)
check('DP4\' usage API 与 Cloud Meter 一致', dUsage?.data?.executions === meterCloud.executions && dUsage?.data?.successful === meterCloud.successful, { api: dUsage?.data?.executions, cloud: meterCloud.executions })

// ── DP5': Runtime 边界扫描（Desktop 源码）──
console.log('\n── DP5\': Runtime 边界 ──')
import { readFileSync } from 'node:fs'
const ui = readFileSync('/root/shipin-cinematic-studio/desktop/ui/index.html', 'utf-8')
const noKey = !/sk-[A-Za-z0-9]{8,}|DEEPSEEK|VOLCENGINE/.test(ui)
const noSkillExec = !/executeSkillPlan|resume\.parse|candidate\.score|interview\.evaluate/.test(ui)
const hermesHits = (ui.match(/\/invocations/g) || []).length
check('DP5\' Desktop 0 provider key / 0 Skill 执行', noKey && noSkillExec, { noKey, noSkillExec })
check('DP5\' Hermes 仅契约握手（≤1 处, 非执行）', hermesHits <= 1, hermesHits)
const lib = readFileSync('/root/shipin-cinematic-studio/desktop/src-tauri/src/lib.rs', 'utf-8')
check('DP5\' Rust Host 白名单保持（open_workspace）', lib.includes('aigc.fushtn.com') && lib.includes('白名单'), 'whitelist intact')

// ── DP6': 三员工同时展示（商品卡数据源齐备）──
console.log('\n── DP6\': 三员工同展 ──')
for (const c of [ALICE, DIRECTOR, NEWMEDIA]) {
  const ent = await fetch(`${API}/api/skills/employees/${c}/entitlement`, { headers: H }).then(r => r.json()).catch(() => null)
  const usg = await fetch(`${API}/api/skills/employees/${c}/usage`, { headers: H }).then(r => r.json()).catch(() => null)
  const enh = await fetch(`${API}/api/skills/employees/${c}/enhancements`, { headers: H }).then(r => r.json()).catch(() => null)
  check(`DP6\' ${c} 商品卡数据齐备（授权+用量+增强）`, !!ent?.data?.entitlementState && typeof usg?.data?.executions === 'number' && Array.isArray(enh?.data?.enhancements), { state: ent?.data?.entitlementState, usage: usg?.data?.executions, enh: enh?.data?.enhancements?.length })
}

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
