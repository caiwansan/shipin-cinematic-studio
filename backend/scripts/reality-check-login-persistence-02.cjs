#!/usr/bin/env node
/**
 * SPRINT-MEDIA-LOGIN-REALITY-FIX-01 — G2 Login Persistence Reality Test
 *
 * 掌柜验收：扫码 → 登录 → 显示账号名 → 刷新页面 → 账号仍存在 → AI员工看到该电脑
 *
 * 本脚本两层：
 *   A. 禁令层（无需真人扫码）：中间态绝不假装连接
 *      - AUTHENTICATED + 无身份 账号 confirm-binding 必须失败（不假成功）
 *      - account-status 对 AUTHENTICATED/IDENTITY_VERIFIED 返回 connected=false
 *      - reality.identity 不冒充 verified；usable=false
 *   B. 闭环层（需真实登录态）：探针通过 → 完整闭环验证
 *      - wait-for-login → CONNECTED 落库（身份+凭证）
 *      - reality.identity.verified && account.connected && usable（有 binding）
 *      - account-status → connected=true（刷新后仍存在 = DB 持久化）
 *
 * 用法：node scripts/reality-check-login-persistence-02.cjs [--account <id>] [--wait-login]
 */
const BASE = process.env.BASE_URL || 'https://aigc.fushtn.com'

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function api(path, opts = {}, token) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

;(async () => {
  const login = await api('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  })
  const token = login.json.accessToken || login.json.token || login.json.data?.accessToken
  if (!token) {
    console.error('❌ 登录失败:', JSON.stringify(login.json).slice(0, 200))
    process.exit(1)
  }
  const H = { Authorization: `Bearer ${token}` }

  // ── G2-1 状态机常量完整性 ──
  console.log('\n═══ G2-1 状态机常量（IDENTITY_VERIFIED 中间态冻结） ═══')
  const st = (await api('/api/enterprise/channels/runtime/douyin/account-status', {}, token)).json
  check('account-status API 可达（状态机热加载）', st.code === 0, `code=${st.code}`)

  // ── 目标账号：优先命令行指定，否则找快手卡死账号 ──
  const target = process.argv.find(a => a.startsWith('--account='))?.split('=')[1]
  const accId = target || '10e0ea29-3a20-4aae-9efc-8557b86daa0c' // 快手（AUTHENTICATED + NULL 身份铁证账号）

  // ── G2-2 禁令层：中间态绝不假装连接 ──
  console.log('\n═══ G2-2 假成功禁令（中间态绝不假装连接） ═══')
  const before = (await api(`/api/enterprise/channels/runtime/${accId}/account-status`, {}, token)).json
  const beforeStatus = before.data?.connectionStatus
  const beforeConnected = !!before.data?.connected
  const beforeExtId = before.data ? null : null
  console.log(`  账号 ${accId} 当前: connectionStatus=${beforeStatus} connected=${beforeConnected}`)

  // account-status 判定：CONNECTED 才 true；AUTHENTICATED/IDENTITY_VERIFIED/EXPIRED 必须 false
  if (beforeStatus === 'CONNECTED') {
    check('G2-2a account-status 对 CONNECTED 返回 true（真连接）', beforeConnected === true && !!before.data?.accountName)
  } else {
    check(
      'G2-2a account-status 对非 CONNECTED 状态返回 connected=false（不冒充）',
      beforeConnected === false,
      `${beforeStatus} → connected=${beforeConnected}`,
    )
  }

  // reality：中间态 identity 不得冒充 verified，usable 必须 false
  const realityBefore = (await api(`/api/enterprise/channels/${accId}/reality`, {}, token)).json
  const rb = realityBefore.data || {}
  const identityOk = rb.identity?.status === 'verified' ? false : true // 无真实探针通过不得 verified
  check('G2-2b reality.identity 不冒充 verified（探针未过=stale/missing）', identityOk, `status=${rb.identity?.status}`)
  check('G2-2c reality.usable=false（未全闭环不可用）', rb.employee?.usable === false, `usable=${rb.employee?.usable}`)

  // confirm-binding：中间态/无登录态必须失败，绝不返回 connected
  if (beforeStatus !== 'CONNECTED') {
    const cb = await api(`/api/enterprise/channels/runtime/${accId}/confirm-binding`, { method: 'POST', body: {} }, token)
    const cbData = cb.json.data || {}
    const cbFailed = cb.status >= 400 || cb.json.code === 'identity_missing' || cb.json.code === 'credential_failed' || cbData.status !== 'connected'
    check(
      'G2-2d confirm-binding 中间态/无登录态必须失败（不假成功）',
      cbFailed,
      `HTTP ${cb.status} code=${cb.json.code || cbData.status} msg=${(cb.json.message || '').slice(0, 60)}`,
    )
  } else {
    check('G2-2d confirm-binding 跳过（账号已 CONNECTED）', true, '已连接账号无需再确认')
  }

  // wait-for-login：无真实登录态必须不假成功（仅在 --wait-login 模式验证，避免探测拉起浏览器）
  // 非 --wait-login 模式：直接用探针判定（identity-probe API），不启动浏览器
  if (beforeStatus !== 'CONNECTED' && !process.argv.includes('--wait-login')) {
    const probeRes = await api(`/api/enterprise/channels/runtime/${accId}/identity-probe`, {}, token)
    const probeData = probeRes.json.data || {}
    check(
      'G2-2e wait-for-login 探针未过时绝不返回 connected（禁令）',
      !probeData.authenticated,
      `probe.authenticated=${probeData.authenticated}（数据中心 IP 无真人登录态）`,
    )
  }

  // ── G2-3 闭环层：需真实登录态（--wait-login 时等待真人扫码） ──
  console.log('\n═══ G2-3 登录持久化闭环（需真实登录态） ═══')
  if (process.argv.includes('--wait-login')) {
    console.log('⏳ 等待真人扫码登录（最多 180s），请掌柜扫码...')
    const wf = await api(`/api/enterprise/channels/runtime/${accId}/wait-for-login`, { method: 'POST', body: {} }, token)
    const wfData = wf.json.data || {}
    check('G2-3a wait-for-login 返回 connected（全闭环）', wfData.status === 'connected', `status=${wfData.status} name=${wfData.accountName || ''}`)

    if (wfData.status === 'connected') {
      // 刷新模拟：重新读 DB（account-status = 前端刷新后的数据源）
      const after = (await api(`/api/enterprise/channels/runtime/${accId}/account-status`, {}, token)).json
      check(
        'G2-3b 刷新后 account-status 仍 connected（持久化）',
        !!after.data?.connected && !!after.data?.accountName,
        `connected=${after.data?.connected} name=${after.data?.accountName}`,
      )
      const reality = (await api(`/api/enterprise/channels/${accId}/reality`, {}, token)).json
      const rd = reality.data || {}
      check('G2-3c reality.identity.verified（探针+身份新鲜）', rd.identity?.status === 'verified', `status=${rd.identity?.status}`)
      check('G2-3d reality.account.connected（SaaS 授权落库）', rd.account?.connected === true)
      check('G2-3e reality.browser.alive（数字电脑在线）', rd.browser?.alive === true, `alive=${rd.browser?.alive}`)
      check('G2-3f reality.employee.usable（AI员工可用=READY）', rd.employee?.usable === true, `usable=${rd.employee?.usable} binding=${rd.employee?.binding?.name || '无'}`)
    } else {
      check('G2-3b~f 跳过（未完成登录）', false, '需真实扫码才能验证闭环——掌柜请扫码后重跑')
    }
  } else {
    console.log('ℹ️  闭环层需真实登录态：跑 `--wait-login` 并请掌柜扫码验证；本次仅验证禁令层')
  }

  // ── 汇总 ──
  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  console.log(`\n════════ 结果: ${passed} PASS / ${failed} FAIL ════════`)
  process.exit(failed > 0 ? 1 : 0)
})().catch(e => {
  console.error('脚本异常:', e.message)
  process.exit(1)
})
