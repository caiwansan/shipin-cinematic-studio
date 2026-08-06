/**
 * S6.2 Windows Release Engineering — Release Gate（RG1-RG6）
 * RG1-3/RG5: 服务器侧只验配置就绪 + 实机项记录待 Windows 开发机
 * RG4: 边界扫描（Desktop 0 key/0 provider/0 runtime/0 skill 执行）
 * RG6: 云端回归（Alice + 短剧 + 新媒体 + 插件增强）
 */
import { readFileSync } from 'node:fs'
import { executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const USER_A = process.env.TENANT_A_USER || ''
const ALICE = 'def-recruiter-alice'
const DIRECTOR = 'def-shortdrama-director'
const NEWMEDIA = 'def-newmedia-ops'

console.log('══ S6.2 Windows Release Gate（RG1-RG6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── RG1/RG2/RG3 配置就绪（实机验证待 Windows 开发机）──
console.log('\n── RG1-3: 配置就绪 ──')
const conf = readFileSync('/root/shipin-cinematic-studio/desktop/src-tauri/tauri.conf.json', 'utf-8')
const confObj = JSON.parse(conf)
check('RG1 bundle.targets=nsis 配置就绪', (confObj.bundle?.targets || []).includes('nsis'), confObj.bundle?.targets)
check('RG2 installer 模式 currentUser（普通用户目录安装）', confObj.bundle?.windows?.nsis?.installMode === 'currentUser', confObj.bundle?.windows?.nsis?.installMode)
check('RG3 productName/identifier 就绪', confObj.productName === 'Kunlun Media' && confObj.identifier === 'com.kunlun.desktop', `${confObj.productName}/${confObj.identifier}`)
const pkg = JSON.parse(readFileSync('/root/shipin-cinematic-studio/desktop/package.json', 'utf-8'))
const cargo = readFileSync('/root/shipin-cinematic-studio/desktop/src-tauri/Cargo.toml', 'utf-8')
const cargoVer = cargo.match(/^version = "([^"]+)"/m)?.[1]
check('RG3 版本权威对齐（package=tauri=Cargo）', pkg.version === confObj.version && cargoVer === confObj.version, { pkg: pkg.version, tauri: confObj.version, cargo: cargoVer })

// ── RG4: 边界扫描 ──
console.log('\n── RG4: Security Boundary ──')
const ui = readFileSync('/root/shipin-cinematic-studio/desktop/ui/index.html', 'utf-8')
const lib = readFileSync('/root/shipin-cinematic-studio/desktop/src-tauri/src/lib.rs', 'utf-8')
const src = ui + '\n' + lib
const noKey = !/sk-[A-Za-z0-9]{8,}|DEEPSEEK|VOLCENGINE/.test(src)
const noProvider = !src.includes('unifiedAIGateway')
const noRuntime = !src.includes('hermes-skill-runtime') && !src.includes('executeSkillPlan')
const noExec = !/resume\.parse|candidate\.score|interview\.evaluate|content\.draft|script\.analysis/.test(src)
check('RG4 0 provider key / 0 provider 调用', noKey && noProvider, { noKey, noProvider })
check('RG4 0 runtime 代码 / 0 skill 执行', noRuntime && noExec, { noRuntime, noExec })

// ── RG5: Update Capability（DOCUMENTED NOT READY）──
console.log('\n── RG5: Upgrade Reality ──')
const updater = conf.includes('updater') || conf.includes('pubkey')
check('RG5 updater 未配置（DOCUMENTED NOT READY, 不强行实现）', updater === false, 'documented not ready')

// ── RG6: 云端回归（三员工 + 插件增强）──
console.log('\n── RG6: 云端回归 ──')
const rAlice = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-candidate-scorer', tool: 'candidate.score', input: { resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: '互联网研发岗', tenantUserId: USER_A } }],
}).catch(() => null)
check('RG6 Alice + 插件增强 COMPLETED', rAlice?.plan?.status === 'COMPLETED' && rAlice?.plan?.steps?.[0]?.result?.result?.source === 'real', rAlice?.plan?.status)
const rDir = await executeSkillPlan({
  employeeDefinitionId: DIRECTOR, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }],
}).catch(() => null)
check('RG6 短剧导演 COMPLETED', rDir?.plan?.status === 'COMPLETED', rDir?.plan?.status)
const rNm = await executeSkillPlan({
  employeeDefinitionId: NEWMEDIA, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }],
}).catch(() => null)
check('RG6 新媒体 COMPLETED', rNm?.plan?.status === 'COMPLETED', rNm?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
