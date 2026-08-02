/**
 * SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task04 — Owner View 产品化 Reality Gate
 *
 * 掌柜蓝图（老板视角最终卡片）：
 *   AI员工 Alice → 🖥 数字电脑(抖音运营电脑) → 账号(南坡万) → 🟢在线 → 今日读取(粉丝/作品) → AI判断(可信度 Strong)
 *
 * V1 owner-view 返回 channelAccountId / health / aiInsight 字段
 * V2 健康状态透传：NEEDS_ATTENTION（绑定已暂停）→ owner-view 仍展示 + workerStatus=attention + health 块
 * V3 aiInsight 置信度：无可用快照 → warning；有 30 天快照 → strong
 * V4 前端源码包含 AI 判断 / 置信度徽章 / 健康恢复按钮
 * V5 前端生产构建成功（.output 产物 + 页面 200）
 * V6 recover 联动：老板恢复 → owner-view 回到 HEALTHY + 绑定 active
 *
 * 运行：npx tsx scripts/reality-check-ai-employee-reality-01-task04.ts
 */
import { prisma } from '../src/utils/index.js'
import { channelHealthGuardService } from '../src/services/enterprise/channel/channel-health-guard.service.js'

const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function main() {
  console.log('═══ SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task04: Owner View 产品化 ═══\n')

  const aliceId = '7e0b486f-f3d4-49f0-8bcc-0ecbfe62b63c'
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const loginJson: any = await loginRes.json()
  const token = loginJson.accessToken || loginJson.token || loginJson.data?.accessToken || ''
  check('V 前置：admin 登录成功', !!token)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const getOwnerView = async () => {
    const r = await fetch(`${BASE}/api/enterprise/workspaces/owner-view?businessType=media`, { headers })
    const j: any = await r.json()
    return (j.data || [])
  }

  // ── V1 字段完整性 ──
  console.log('── V1 owner-view 字段完整性 ──')
  const rows1 = await getOwnerView()
  const realRow = rows1.find((r: any) => r.channelAccountId === '08a0f643-fb0d-48d5-af18-ad87bd9a34fb')
  check('V1 真实账号行存在（南坡万）', !!realRow)
  if (realRow) {
    check('V1 返回 channelAccountId（recover 前置）', !!realRow.channelAccountId)
    check('V1 返回 health 块', !!realRow.health && ['HEALTHY', 'DEGRADED', 'NEEDS_ATTENTION'].includes(realRow.health.state), `(${realRow.health?.state})`)
    check('V1 返回 aiInsight 块（含 confidence）', !!realRow.aiInsight?.confidence && ['strong', 'medium', 'weak', 'warning'].includes(realRow.aiInsight.confidence.level), `(level=${realRow.aiInsight?.confidence?.level})`)
    check('V1 metrics 块存在', !!realRow.metrics)
  }
  console.log()

  // ── V2/V3/V6 联动：临时 NEEDS_ATTENTION 账号 → owner-view 展示 → recover → 恢复 ──
  console.log('── V2/V3/V6 健康联动（保护账号仍可见 + 恢复）──')
  const tempAccount = await prisma.enterpriseChannelAccount.create({
    data: {
      tenantId: 'default', channelType: 'douyin', channelName: 'OwnerView保护测试号',
      connectionStatus: 'CONNECTED', ownerId: 'test-owner', ownerType: 'gov_user',
      organizationId: 'default', externalAccountId: 'owner-view-test-001', accountName: 'OwnerView测试号',
    },
  })
  const tempWs = await prisma.browserWorkspace.create({
    data: {
      tenantId: 'default', organizationId: 'default', channelAccountId: tempAccount.id,
      profilePath: '/tmp/owner-view-test-profile', status: 'RUNNING', businessType: 'media',
    },
  })
  const tempBinding = await prisma.agentChannelBinding.create({
    data: {
      tenantId: 'default', agentInstanceId: aliceId, channelAccountId: tempAccount.id,
      browserWorkspaceId: tempWs.id, permissions: { read: true } as any, status: 'active',
    },
  })
  const cleanup = async () => {
    await prisma.agentChannelBinding.deleteMany({ where: { channelAccountId: tempAccount.id } }).catch(() => {})
    await prisma.browserWorkspace.delete({ where: { id: tempWs.id } }).catch(() => {})
    await prisma.channelHealthState.deleteMany({ where: { channelAccountId: tempAccount.id } }).catch(() => {})
    await prisma.channelMetricSnapshot.deleteMany({ where: { channelAccountId: tempAccount.id } }).catch(() => {})
    await prisma.enterpriseChannelAccount.delete({ where: { id: tempAccount.id } }).catch(() => {})
  }

  // V3a：无快照 → aiInsight warning
  const rowsBefore = await getOwnerView()
  const tempRowBefore = rowsBefore.find((r: any) => r.channelAccountId === tempAccount.id)
  check('V3a 无快照账号 → aiInsight warning', tempRowBefore?.aiInsight?.confidence?.level === 'warning', `(level=${tempRowBefore?.aiInsight?.confidence?.level})`)

  // V3b：30 天 available 快照 → strong（基准 +10min 余量，防边缘快照被 30 天窗口过滤）
  const now = Date.now() + 10 * 60 * 1000
  for (let i = 30; i >= 0; i -= 2) {
    await prisma.channelMetricSnapshot.create({
      data: {
        tenantId: 'default', organizationId: 'default', channelAccountId: tempAccount.id,
        workspaceId: tempWs.id, agentId: aliceId, platform: 'douyin',
        followerCount: 5000, likeCount: 20000, videoCount: 15,
        recentViews: 30000, recentFollowerDelta: 50, interactionRate: 3.5,
        status: 'available', source: 'creator-center',
        collectedAt: new Date(now - i * 86400000),
      },
    })
  }
  const rowsStrong = await getOwnerView()
  const tempRowStrong = rowsStrong.find((r: any) => r.channelAccountId === tempAccount.id)
  check('V3b 30天+10作品+完整指标 → strong', tempRowStrong?.aiInsight?.confidence?.level === 'strong',
    `(level=${tempRowStrong?.aiInsight?.confidence?.level}, reason=${(tempRowStrong?.aiInsight?.confidence?.reason || '').slice(0, 40)})`)
  check('V3b summary 生成', !!tempRowStrong?.aiInsight?.summary, `(${(tempRowStrong?.aiInsight?.summary || '').slice(0, 40)})`)

  // V2：3 次失败 → NEEDS_ATTENTION + 绑定暂停 → owner-view 仍可见（attention）
  await channelHealthGuardService.recordFailure({ channelAccountId: tempAccount.id, tenantId: 'default', error: '测试失败1', by: 'reality-check' })
  await channelHealthGuardService.recordFailure({ channelAccountId: tempAccount.id, tenantId: 'default', error: '测试失败2', by: 'reality-check' })
  const trig = await channelHealthGuardService.recordFailure({ channelAccountId: tempAccount.id, tenantId: 'default', error: '测试失败3', by: 'reality-check' })
  check('V2 前置：触发 NEEDS_ATTENTION + 绑定暂停', trig.state.state === 'NEEDS_ATTENTION' && trig.pausedBindingIds.includes(tempBinding.id))
  const rowsAttention = await getOwnerView()
  const tempRowAttention = rowsAttention.find((r: any) => r.channelAccountId === tempAccount.id)
  check('V2 保护中账号仍展示（老板能看到）', !!tempRowAttention)
  check('V2 workerStatus=attention（账号保护中）', tempRowAttention?.workerStatus === 'attention', `(${tempRowAttention?.workerStatus})`)
  check('V2 health 块透传 NEEDS_ATTENTION + pauseReason', tempRowAttention?.health?.state === 'NEEDS_ATTENTION' && !!tempRowAttention?.health?.pauseReason,
    `(reason=${(tempRowAttention?.health?.pauseReason || '').slice(0, 40)})`)

  // V6：老板恢复 → HEALTHY + 绑定 active + owner-view 正常展示
  const rec = await channelHealthGuardService.recover(tempAccount.id, { by: 'owner', reason: 'reality-check 恢复' })
  check('V6 recover → HEALTHY + 绑定恢复', rec.state.state === 'HEALTHY' && rec.restoredBindingCount >= 1)
  const rowsAfter = await getOwnerView()
  const tempRowAfter = rowsAfter.find((r: any) => r.channelAccountId === tempAccount.id)
  check('V6 恢复后 health=HEALTHY + 状态回到 working', tempRowAfter?.health?.state === 'HEALTHY' && tempRowAfter?.workerStatus === 'working',
    `(health=${tempRowAfter?.health?.state}, status=${tempRowAfter?.workerStatus})`)

  await cleanup()
  console.log()

  // ── V4/V5 前端 ──
  console.log('── V4/V5 前端（源码 + 生产构建）──')
  const accountsVue = await import('fs').then(fs => fs.readFileSync('/root/shipin-cinematic-studio/frontend/pages/workspace/media/accounts.vue', 'utf8'))
  check('V4 前端含「AI 判断」行', accountsVue.includes('AI 判断'))
  check('V4 前端含置信度徽章（strong/medium/weak/warning）', accountsVue.includes('lv-strong') && accountsVue.includes('lv-warning'))
  check('V4 前端含健康保护展示 + 人工恢复按钮', accountsVue.includes('账号健康') && accountsVue.includes('人工确认恢复'))
  check('V4 前端含 attention 状态（账号保护中）', accountsVue.includes('账号保护中'))
  const outputExists = await import('fs').then(fs => fs.existsSync('/root/shipin-cinematic-studio/frontend/.output/server/index.mjs'))
  check('V5 前端生产构建存在', outputExists)
  const feRes = await fetch('http://127.0.0.1:3000/').catch(() => null)
  check('V5 前端页面 200', feRes?.status === 200)

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
