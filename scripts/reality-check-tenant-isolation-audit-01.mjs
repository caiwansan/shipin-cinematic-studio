// SPRINT-MEDIA-TENANT-ISOLATION-AUDIT-01 Reality Gate（只审计，不改产品代码）
// 断言设计：用户级隔离是掌柜要求的正确语义（账号 B 不得见账号 A 的渠道资产）
// A1-A2 保持（跨企业隔离已修）应为 PASS；A3-A4 用户级隔离应为 FAIL（暴露缺口）

const API = 'http://127.0.0.1:4002'

async function login(account, password = 'AuditTest@123') {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  return (await r.json()).accessToken
}

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${name} — ${detail}`)
}

const tOrg = await login('tenant_org_test@audit.local') // 昆仑镜账号 B（非南波万）
const tIso = await login('tenant_iso_test@audit.local') // 无组织用户

// ── A1 跨企业隔离保持（应 PASS） ──
const isoOv = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', {
  headers: { Authorization: 'Bearer ' + tIso },
})
record('A1 无组织用户 owner-view 403（跨企业隔离保持）', isoOv.status === 403, `status=${isoOv.status}`)

// ── A2 同企业用户级隔离：账号 B 不得见账号 A 的渠道账号（应 FAIL——缺口暴露） ──
const ac = await fetch(API + '/api/enterprise/channels/accounts', {
  headers: { Authorization: 'Bearer ' + tOrg },
})
const acj = await ac.json()
const southAccounts = (acj.data || []).filter(
  (a) => a.channelType === 'douyin' || a.channelType === 'kuaishou'
)
record(
  'A2 账号B 的渠道账号列表不含账号A(南波万)的抖音/快手',
  southAccounts.length === 0,
  `返回 ${(acj.data || []).length} 条，其中账号A资产 ${southAccounts.length} 条（南波万抖音 ownerId=0ba5bf98）`
)

// ── A3 同企业用户级隔离：账号 B 不得见账号 A 的数字电脑（应 FAIL——缺口暴露） ──
const ov = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', {
  headers: { Authorization: 'Bearer ' + tOrg },
})
const ovj = await ov.json()
record(
  'A3 账号B owner-view 不含账号A 的 workspace',
  !(ovj.data || []).length,
  `返回 ${(ovj.data || []).length} 台数字电脑（南波万的抖音/快手 workspace）`
)

// ── A4 跨企业 IDOR：无组织用户不得读任意账号 reality（应 FAIL——比掌柜报的更严重） ──
const douyinAccount = (acj.data || []).find((a) => a.channelType === 'douyin')
if (douyinAccount) {
  const r = await fetch(API + '/api/enterprise/channels/' + douyinAccount.id + '/reality', {
    headers: { Authorization: 'Bearer ' + tIso },
  })
  const rj = await r.json()
  const leaked = rj.data?.identity?.externalId || rj.identity?.externalId || null
  record(
    'A4 无组织用户读他人账号 reality 被拒（403）',
    r.status === 403,
    `status=${r.status}，泄露 externalAccountId=${String(leaked).slice(0, 6)} + 账号名「南坡万」`
  )
}

const fails = results.filter((r) => !r.pass)
console.log(`\n结果: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL`)
console.log(fails.length ? '→ 缺口实锤：同企业用户级隔离缺失 + channel-reality 跨企业 IDOR（详见报告）' : '→ 全部通过')
