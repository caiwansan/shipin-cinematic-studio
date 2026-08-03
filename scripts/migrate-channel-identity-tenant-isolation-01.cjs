/**
 * SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 Task05 — Channel Identity Migration
 * 只重归属，不删除账号。每个迁移写 ChannelAccountOwnerSnapshot。
 */
const { PrismaClient } = require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client')
const p = new PrismaClient()
const OP = 'sprint-tenant-isolation-fix-01'
const NANBOWAN_TENANT = '9af5f6bd-8bcc-4187-aaf7-8909e2122d7e' // 昆仑镜验收测试企业 tenant
const NANBOWAN_ORG = '11111111-2222-4333-8444-555555555555'      // 昆仑镜验收测试企业 govOrg.id
const JUNXIAO_TENANT = 'f28823ce-3d6c-4aef-ac1a-4e235037d528'    // 郑州骏霄 tenant
const JUNXIAO_ORG = 'c7064fde-f51e-4668-8bb7-133a187c1bc5'       // 郑州骏霄 govOrg.id

async function snapshot(rec) {
  await p.channelAccountOwnerSnapshot.create({ data: { ...rec, operator: OP } })
}

async function main() {
  console.log('═══ Task05 Channel Identity Migration ═══\n')

  // ── 0. 建 QUARANTINE 隔离组织（小红书等无主账号） ──
  const Q_TENANT = 'quarantine-0001-0000-0000-000000000000'
  const qTenant = await p.tenant.findUnique({ where: { id: Q_TENANT } }).catch(() => null)
  if (!qTenant) {
    await p.tenant.create({ data: { id: Q_TENANT, name: 'QUARANTINE-租户隔离区', type: 'enterprise' } })
    console.log('✅ 创建 quarantine governance_tenant')
  }
  let qOrg = await p.govOrganization.findFirst({ where: { tenantId: Q_TENANT } })
  if (!qOrg) {
    qOrg = await p.govOrganization.create({
      data: {
        id: 'qqqqqqqq-0000-4000-8000-000000000000',
        name: 'QUARANTINE-租户隔离区',
        tenantId: Q_TENANT,
        type: 'enterprise',
      },
    })
    console.log('✅ 创建 QUARANTINE 组织:', qOrg.id)
  } else console.log('✅ QUARANTINE 已存在')

  // ── 1. 用户侧对齐：掌柜 + 南波万 → 昆仑镜验收测试企业 ──
  const users = [
    { label: '掌柜', email: 'qq_29B53375C1C3CFEAE98C27BAE486D774@aigc.fushtn.com' },
    { label: '南波万', email: 'qq_6F736FAC37ED3A3AF774AE0924374F4D@aigc.fushtn.com' },
  ]
  for (const u of users) {
    const gu = await p.govUser.findFirst({ where: { email: u.email } })
    if (!gu) { console.log(`⚠️ ${u.label} 无 govUser`); continue }
    if (gu.tenantId === NANBOWAN_TENANT) { console.log(`✅ ${u.label} govUser.tenant 已对齐`); continue }
    await snapshot({
      channelAccountId: 'USER-GOVUSER:' + gu.id,
      oldTenantId: gu.tenantId, newTenantId: NANBOWAN_TENANT,
      migrationReason: `用户 govUser.tenant 对齐到真实企业（原 ${gu.tenantId} 无主）`,
    })
    await p.govUser.update({ where: { id: gu.id }, data: { tenantId: NANBOWAN_TENANT } })
    console.log(`✅ ${u.label} govUser.tenant ${gu.tenantId.slice(0, 12)} → ${NANBOWAN_TENANT.slice(0, 12)}`)
  }

  // ── 2. 账号迁移 ──
  const accs = await p.enterpriseChannelAccount.findMany({})
  for (const a of accs) {
    const name = a.accountName || a.channelType
    let newTenant = a.tenantId, newOrg = a.organizationId, reason = null

    if (a.channelType === 'kuaishou') {
      newTenant = NANBOWAN_TENANT; newOrg = NANBOWAN_ORG
      reason = `快手孤儿租户重绑定：tenant ${a.tenantId} 幽灵（无 org/user）→ 归真实企业；owner=${a.ownerId} 保留`
    } else if (a.channelType === 'channels_wechat' && (a.accountName || '').includes('骏霄')) {
      newTenant = JUNXIAO_TENANT; newOrg = JUNXIAO_ORG
      reason = `企业微信账号归郑州骏霄数字科技有限公司（按账号名归属）；owner 空=公司资产`
    } else if (a.channelType === 'xiaohongshu') {
      newTenant = 'quarantine-0001-0000-0000-000000000000'; newOrg = qOrg.id
      reason = `无 owner/无归属信息 → QUARANTINE 隔离区（不删除）`
    }

    if (reason) {
      await snapshot({
        channelAccountId: a.id,
        oldTenantId: a.tenantId || null, newTenantId: newTenant,
        oldOrganizationId: a.organizationId || null, newOrganizationId: newOrg,
        migrationReason: reason,
      })
      await p.enterpriseChannelAccount.update({
        where: { id: a.id },
        data: { tenantId: newTenant, organizationId: newOrg },
      })
      console.log(`✅ ${name} (${a.channelType}): tenant ${String(a.tenantId).slice(0, 12)}→${String(newTenant).slice(0, 12)} | org ${String(a.organizationId).slice(0, 12)}→${String(newOrg).slice(0, 12)}`)
    } else {
      console.log(`⏭️ ${name} (${a.channelType}): 归属已正确（org=${String(a.organizationId).slice(0, 12)}），跳过`)
    }
  }

  // ── 3. 校验：所有账号 organizationId 非空 ──
  const orphans = await p.enterpriseChannelAccount.findMany({ where: { organizationId: null } })
  console.log(`\n校验: organizationId 为空的账号数 = ${orphans.length}`)
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
