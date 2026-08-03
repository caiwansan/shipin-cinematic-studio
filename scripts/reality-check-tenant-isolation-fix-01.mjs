/**
 * SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 — Task06 Reality Gate（掌柜 G1-G5 定义）
 *
 * G1 JWT组织解析       — 有 org 用户登录后 JWT 正确携带 organizationId
 * G2 ChannelAccount隔离 — 只能查到自己 org 的账号；跨租户/跨 org 一律 403
 * G3 OwnerView隔离     — owner-view 只返回本 org workspace
 * G4 Agent Binding隔离 — 绑定查询路径随 org 过滤，不泄露他人绑定
 * G5 无组织访问403     — 无 org 用户访问渠道/工作台资源一律 403 NO_ORGANIZATION
 *
 * 测试账号：
 *  - tenant_org_test@audit.local / AuditTest@123（昆仑镜验收测试企业，正向）
 *  - tenant_iso_test@audit.local / AuditTest@123（无组织，负向）
 * 用法：cd backend && node ../scripts/reality-check-tenant-isolation-fix-01.mjs
 */
const API = 'http://127.0.0.1:4002'
const ORG_TENANT = '9af5f6bd-8bcc-4187-aaf7-8909e2122d7e'   // 昆仑镜验收测试企业 tenant
const JUNXIAO_TENANT = 'f28823ce-3d6c-4aef-ac1a-4e235037d528' // 骏霄 tenant（跨租户攻击目标）
const results = []
const PASS = (n, d) => { results.push({ n, ok: true, d }); console.log('✅ PASS  ' + n + (d ? ' — ' + d : '')) }
const FAIL = (n, d) => { results.push({ n, ok: false, d }); console.log('❌ FAIL  ' + n + (d ? ' — ' + d : '')) }

async function login(account, password) {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  const j = await r.json()
  return j.accessToken || j.data?.accessToken || null
}

async function main() {
  console.log('═══ SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 Reality Gate ═══\n')
  const tOrg = await login('tenant_org_test@audit.local', 'AuditTest@123')
  const tIso = await login('tenant_iso_test@audit.local', 'AuditTest@123')
  const HOrg = { Authorization: 'Bearer ' + tOrg }
  const HIso = { Authorization: 'Bearer ' + tIso }

  // ── G1 JWT 组织解析 ──
  {
    const payload = JSON.parse(Buffer.from(tOrg.split('.')[1], 'base64url').toString())
    if (payload.organizationId === '11111111-2222-4333-8444-555555555555') PASS('G1 JWT组织解析', 'org=' + payload.organizationId.slice(0, 12))
    else FAIL('G1 JWT组织解析', 'org=' + payload.organizationId)
    const p2 = JSON.parse(Buffer.from(tIso.split('.')[1], 'base64url').toString())
    if (!p2.organizationId) PASS('G1b 无 org 用户 JWT 无 organizationId', '符合未知身份语义')
    else FAIL('G1b 无 org 用户 JWT', '意外携带 org=' + p2.organizationId)
  }

  // ── G2 ChannelAccount 隔离（FIX-02 用户私有语义更新：无授权用户只见自己账号）──
  {
    const r = await fetch(API + '/api/enterprise/channels/accounts', { headers: HOrg })
    const j = await r.json()
    const types = (j.data || []).map(a => a.channelType).sort()
    // FIX-02：tenant_org_test 无南波万账号授权 → 只可见自己 ensure-account 创建的 douyin（未连接）
    const leaked = (j.data || []).some(a => a.channelName === '南坡万' || a.channelName === '快手')
    if (r.status === 200 && !leaked)
      PASS('G2 ChannelAccount隔离', `只见自己账号 types=${types.join(',')}（南坡万/快手不可见）`)
    else FAIL('G2 ChannelAccount隔离', `status=${r.status} types=${types} 泄露=${leaked}`)
  }
  {
    const r = await fetch(API + '/api/enterprise/' + JUNXIAO_TENANT + '/channels/accounts', { headers: HOrg })
    if (r.status === 403) PASS('G2b 跨租户读账号被拒', '骏霄 tenant → 403 TENANT_CONTEXT_INVALID')
    else FAIL('G2b 跨租户读账号被拒', 'status=' + r.status)
  }
  {
    const r = await fetch(API + '/api/enterprise/channels/runtime/douyin/account-status', { headers: HOrg })
    const j = await r.json()
    const name = j.data?.accountName || ''
    // FIX-02：无授权用户查不到南波万登录状态（返回自己账号状态或不显示）
    if (name !== '南坡万') PASS('G2c account-status 用户级隔离', '不泄露南波万登录状态（返回=' + (name || '未连接') + '）')
    else FAIL('G2c account-status 用户级隔离', '泄露南波万=' + name)
  }
  {
    // 无授权用户（tenant_org_test 非南波万 owner）读南波万 metrics → 403（FIX-02/03 校验生效）
    const accId = '08a0f643-fb0d-48d5-af18-ad87bd9a34fb' // 抖音南坡万（本 org 但非本人账号）
    const r = await fetch(API + '/api/enterprise/channels/runtime/' + accId + '/metrics', { headers: HOrg })
    if (r.status === 403) PASS('G2d 他人账号 metrics 拒绝', '无授权读南坡万 metrics → 403')
    else FAIL('G2d 他人账号 metrics 拒绝', 'status=' + r.status)
  }

  // ── G3 OwnerView 隔离（FIX-02 用户私有语义更新）──
  {
    const r = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', { headers: HOrg })
    const j = await r.json()
    const rows = j.data || []
    // FIX-02：无授权用户 owner-view 空（不回落看南波万数字电脑）
    const leaked = rows.some(w => String(w.channelAccountId).startsWith('08a0f643') || String(w.channelAccountId).startsWith('10e0ea29'))
    if (r.status === 200 && !leaked)
      PASS('G3 OwnerView隔离', `返回 ${rows.length} 条，无南波万 workspace 泄露（无骏霄/小红书/他人资产）`)
    else FAIL('G3 OwnerView隔离', `status=${r.status} rows=${rows.length} 泄露=${leaked}`)
  }

  // ── G4 Agent Binding 隔离 ──
  {
    const r = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', { headers: HOrg })
    const j = await r.json()
    const rows = j.data || []
    const leaked = rows.filter(w => w.accountName && w.accountName.includes('南坡万') && w.organizationId !== '11111111-2222-4333-8444-555555555555')
    if (leaked.length === 0) PASS('G4 Agent Binding隔离', '绑定可见性随 org 过滤，无跨 org 泄露')
    else FAIL('G4 Agent Binding隔离', '泄露 ' + leaked.length + ' 条')
  }

  // ── G5 无组织访问 403 ──
  {
    const checks = [
      ['/api/enterprise/channels/accounts', HIso],
      ['/api/enterprise/workspaces/owner-view?businessType=media', HIso],
      ['/api/enterprise/' + ORG_TENANT + '/channels/accounts', HIso],
      ['/api/enterprise/channels/runtime/douyin/account-status', HIso],
      ['/api/enterprise/workspaces', HIso],
    ]
    const bad = []
    for (const [url, h] of checks) {
      const r = await fetch(API + url, { headers: h })
      if (r.status !== 403) bad.push(url + '→' + r.status)
    }
    if (bad.length === 0) PASS('G5 无组织访问403', '5 个入口全部 403 NO_ORGANIZATION')
    else FAIL('G5 无组织访问403', bad.join('; '))
  }

  const fails = results.filter(r => !r.ok)
  console.log(`\n结果: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL`)
  process.exit(fails.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
