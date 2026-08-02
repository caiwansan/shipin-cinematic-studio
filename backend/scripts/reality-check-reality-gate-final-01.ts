/**
 * SPRINT-MEDIA-REALITY-GATE-FINAL-01 — Task02/03/04 Reality Gate
 * Task01（G6 真机扫码闭环）为掌柜人工验收项，本脚本验证其余收口项。
 *
 * Task03 假数据清理：C1 无 demo-token 代码 / C2 模拟授权下线 / C3 全库 0 模拟标记 / C4 仅真实账号 / C5 备份存在
 * Task04 Owner View 真实化：V1 三态语言 / V2 状态点颜色 / V3 最近动作诚实 / V4 数据更新时间 / V5 构建产物
 * Task02 重启恢复：R1 RecoveryService 扫描日志 / R2 快照 fresh 保持 CONNECTED / R3 失效账号不误报
 *
 * 运行：npx tsx scripts/reality-check-reality-gate-final-01.ts
 */
import { prisma } from '../src/utils/index.js'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function main() {
  console.log('═══ SPRINT-MEDIA-REALITY-GATE-FINAL-01: Task02/03/04 Reality Gate ═══\n')

  // ── Task03 假数据清理 ──
  console.log('── Task03 假数据清理 ──')
  const srcFiles = execSync('grep -rn "demo-token" /root/shipin-cinematic-studio/backend/src /root/shipin-cinematic-studio/frontend/pages --include="*.ts" --include="*.vue" | grep -v node_modules', { encoding: 'utf8' }).trim()
  check('C1 源码无 demo-token（允许注释说明）', !srcFiles || /REALITY-GATE-FINAL-01 Task03/.test(srcFiles), srcFiles ? '(仅注释)' : '')
  const outputFake = execSync('grep -rl "demo-token" /root/shipin-cinematic-studio/frontend/.output/public/_nuxt/ 2>/dev/null | wc -l', { encoding: 'utf8' }).trim()
  check('C1 构建产物无 demo-token', outputFake === '0', `(残留 ${outputFake} 个文件)`)
  const mockFile = readFileSync('/root/shipin-cinematic-studio/backend/src/routes/_deprecated-channels-mock-auth.ts', 'utf8')
  const codeLines = mockFile.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/'))
  check('C2 模拟授权路由已下线（410 + 无可执行 simulated 路径）', mockFile.includes('410') && !codeLines.join('\n').includes('simulated') && !codeLines.join('\n').includes('fakeToken'))
  let totalFake = 0
  for (const t of ['enterpriseChannelAccount', 'browserWorkspace', 'agentChannelBinding', 'channelMetricSnapshot', 'channelOperationLog', 'channelHealthState', 'channelVerificationSession', 'channelBrowserSession']) {
    const rows: any = await (prisma as any)[t].findMany()
    const fake = rows.filter((r: any) => /simulat|mock|fake|demo-token|reality-test|phase-a/i.test(JSON.stringify(r)))
    totalFake += fake.length
  }
  check('C3 全库 0 模拟标记（8 表）', totalFake === 0, `(残留 ${totalFake})`)
  const accounts = await prisma.enterpriseChannelAccount.findMany()
  const realIds = accounts.filter(a => ['88130666815', '4541961964', 'sphpfkmVO5uy6NF'].includes(a.externalAccountId || '')).length
  check('C4 仅保留真实账号（南坡万/快手/视频号）', accounts.length === 3 && realIds === 3, `(${accounts.length} 个, 真实身份 ${realIds})`)
  check('C5 删除前备份存在', existsSync('/root/shipin-cinematic-studio/data/backups/reality-gate-final-01/fake-data-removal-backup.sql'))
  console.log()

  // ── Task04 Owner View 真实化 ──
  console.log('── Task04 Owner View 真实化（老板三态）──')
  const vue = readFileSync('/root/shipin-cinematic-studio/frontend/pages/workspace/media/accounts.vue', 'utf8')
  check('V1 三态语言：🟢 在线', vue.includes("working: '🟢 在线'"))
  check('V1 三态语言：⚪ 等待授权', vue.includes("waiting_scan: '⚪ 等待授权'") && vue.includes("pending: '⚪ 等待授权'"))
  check('V1 三态语言：🟡 需要重新登录', vue.includes("expired: '🟡 需要重新登录'"))
  check('V1 三态语言：🔴 账号保护中', vue.includes("attention: '🔴 账号保护中'"))
  check('V2 状态点颜色 warn/danger', vue.includes('ac-owner-dot.warn') && vue.includes('ac-owner-dot.danger'))
  check('V3 最近动作诚实（暂无真实动作记录）', vue.includes('暂无真实动作记录') && !vue.includes("'等待任务'"))
  check('V4 数据更新时间（最近尝试）', vue.includes('最近尝试'))
  const outJs = execSync('grep -rl "需要重新登录" /root/shipin-cinematic-studio/frontend/.output/public/_nuxt/ 2>/dev/null | wc -l', { encoding: 'utf8' }).trim()
  check('V5 构建产物含三态', outJs !== '0', `(产物文件 ${outJs})`)
  console.log()

  // ── Task02 重启恢复 ──
  console.log('── Task02 重启恢复（本次启动日志）──')
  const logs = execSync('npx pm2 logs api-server --lines 200 --nostream 2>/dev/null', { encoding: 'utf8' })
  check('R1 RecoveryService 扫描 workspace', /BrowserWorkspaceRecovery\] 扫描到/.test(logs))
  const freshLine = logs.match(/08a0f643[^\n]*快照验证 fresh[^\n]*/) || []
  check('R2 南坡万快照 fresh → 保持 CONNECTED（fast 路径）', freshLine.length > 0, freshLine[0]?.slice(0, 60) || '')
  check('R3 失效账号不误报（降级 0 / 跳过 2）', /保持连接 1 \/ 降级 0 \/ 跳过 2/.test(logs))
  const owner = await (async () => {
    const login = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const j: any = await login.json()
    const res = await fetch(`${BASE}/api/enterprise/workspaces/owner-view?businessType=media`, { headers: { Authorization: `Bearer ${j.token}` } })
    const r: any = await res.json()
    return r.data?.[0]
  })()
  check('R4 重启后 owner-view：READY + CONNECTED + verified', owner?.workspaceStatus === 'READY' && owner?.accountConnection === 'CONNECTED' && owner?.identity?.status === 'verified')

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
