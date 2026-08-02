/**
 * SPRINT-MEDIA-TENANT-ISOLATION-AUDIT-01 — Task04 Reality Gate
 * 租户隔离验证（只测不改）：验证「账号 B 看不到账号 A 的渠道资产」
 *
 * 用例：
 *  G1 无企业用户跨 tenantId 读渠道列表 → 必须被拒/空（当前 500 = FAIL，非隔离）
 *  G2 无企业用户 owner-view        → 必须空（当前空 = 假阴性 PASS，代码路径仍有漏洞）
 *  G3 tenant-guard 挂载检查        → 必须已挂载（当前未挂载 = FAIL）
 *  G4 南波万用户 org 一致性        → 用户 org 与账号 org 必须一致（当前不一致 = FAIL）
 *  G5 registry 无敏感数据          → PASS（平台能力清单，无账号数据）
 *
 * 用法：node scripts/reality-check-tenant-isolation-01.mjs
 */
const API = 'http://127.0.0.1:4002'
const NANBOWAN_TENANT = '9af5f6bd-8bcc-4187-aaf7-8909e2122d7e' // 昆仑镜验收测试企业(抖音南波万)
const results = []
const PASS = (name, detail) => { results.push({ name, ok: true, detail }); console.log('✅ PASS  ' + name + ' — ' + detail) }
const FAIL = (name, detail) => { results.push({ name, ok: false, detail }); console.log('❌ FAIL  ' + name + ' — ' + detail) }

async function login(account, password) {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  const j = await r.json()
  return { token: j.accessToken || j.data?.accessToken, raw: j }
}

// G1: 无企业用户跨租户读渠道列表
async function g1() {
  const { token } = await login('career_ui_test@test.com', 'AuditTest@123')
  if (!token) return FAIL('G1 登录', 'careeruitest 无法登录')
  const r = await fetch(API + '/api/enterprise/' + NANBOWAN_TENANT + '/channels/accounts', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const j = await r.json()
  if (r.status === 500 || j.statusCode === 500) {
    return FAIL('G1 跨租户读账号', `HTTP ${r.status} — 权限服务 bug 挡路（非隔离）：${(j.message || '').slice(0, 80)}`)
  }
  const accounts = j.data || []
  if (accounts.length === 0) return PASS('G1 跨租户读账号', '返回空（被隔离）')
  return FAIL('G1 跨租户读账号', `泄露 ${accounts.length} 个账号：${JSON.stringify(accounts.map(a => a.accountName || a.channelName))}`)
}

// G2: 无企业用户 owner-view
async function g2() {
  const { token } = await login('career_ui_test@test.com', 'AuditTest@123')
  const r = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const j = await r.json()
  const rows = j.data || []
  if (rows.length === 0) {
    return PASS('G2 无企业用户 owner-view', '当前返回空（但为假阴性：绑定 agent 数据残缺，代码路径无 org 过滤——见报告 S-2）')
  }
  return FAIL('G2 无企业用户 owner-view', `泄露 ${rows.length} 条：${JSON.stringify(rows.map(r => r.accountName || r.channelName))}`)
}

// G3: tenant-guard 是否挂载
async function g3() {
  const { token } = await login('career_ui_test@test.com', 'AuditTest@123')
  // 传客户端 tenantId 应被 tenant-guard 403；未挂载则走正常逻辑（200/500 都算未挂载）
  const r = await fetch(API + '/api/enterprise/' + NANBOWAN_TENANT + '/channels/accounts?tenantId=hack-attempt', {
    headers: { Authorization: 'Bearer ' + token },
  })
  if (r.status === 403 && (await r.json()).error === 'TENANT_CONTEXT_INVALID') {
    return PASS('G3 tenant-guard 挂载', '客户端 tenantId 被 403 拒绝')
  }
  return FAIL('G3 tenant-guard 挂载', `未生效（HTTP ${r.status}）——registerTenantGuard 零注册（grep 证实）`)
}

// G4: 南波万用户 org 一致性（用户 govUser.tenant → org vs 账号 org）
async function g4() {
  const { PrismaClient } = await import('@prisma/client')
  const p = new PrismaClient()
  const acc = await p.enterpriseChannelAccount.findFirst({ where: { channelType: 'douyin' } })
  const govUser = await p.govUser.findFirst({ where: { email: { contains: 'qq_6F736FAC37ED3A3AF774AE0924374F4D' } } })
  const govOrg = govUser ? await p.govOrganization.findFirst({ where: { tenantId: govUser.tenantId } }) : null
  const userOrgId = govOrg?.id || null
  await p.$disconnect()
  if (!userOrgId) return FAIL('G4 南波万 org 一致性', '南波万用户无 govUser→org 链')
  if (userOrgId === acc.organizationId) return PASS('G4 南波万 org 一致性', `用户 org=${userOrgId} = 账号 org`)
  return FAIL('G4 南波万 org 一致性', `用户 org=${userOrgId} ≠ 账号 org=${acc.organizationId}——南波万本人登录看不到自己的抖音账号`)
}

// G5: registry 无敏感数据
async function g5() {
  const { token } = await login('career_ui_test@test.com', 'AuditTest@123')
  const r = await fetch(API + '/api/enterprise/channels/registry', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const data = JSON.stringify(j.data || {})
  if (/accountName|externalAccountId|南坡万|南波万/.test(data)) return FAIL('G5 registry', '泄露账号身份')
  return PASS('G5 registry', '仅平台能力清单，无账号数据')
}

async function main() {
  console.log('═══ SPRINT-MEDIA-TENANT-ISOLATION-AUDIT-01 Reality Gate ═══\n')
  await g1(); await g2(); await g3(); await g4(); await g5()
  const fails = results.filter(r => !r.ok)
  console.log(`\n结果: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL`)
  process.exit(fails.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
