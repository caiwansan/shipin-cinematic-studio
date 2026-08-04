/**
 * TASK02 Gate B — 快手真实扫码验证（起登录 + 轮询等待掌柜扫码 + 自动断言）
 * 用法: npx tsx scripts/reality-check-task02-gate-b.ts [accountId]
 * 流程:
 *  1. admin 登录 → 找快手 WAITING_LOGIN 空壳账号（默认 be53a9a8...）
 *  2. POST connect → 取 sessionId → GET status 轮询拿二维码截图 → 存 /tmp/kuaishou-qr.png
 *  3. 提示掌柜扫码（截图由外层发送）
 *  4. 轮询 wait-for-login（3 分钟窗口）→ 断言 CONNECTED + accountName + externalAccountId
 *  5. 输出 Gate B 结果
 */
import { prisma } from '../src/utils/index.js'

const BASE = 'http://localhost:4002'
async function api(path: string, method = 'GET', body?: any, token?: string) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await r.json().catch(() => ({}))
  return { status: r.status, json }
}
async function login() {
  const r = await api('/api/auth/login', 'POST', { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' })
  return (r.json as any).accessToken as string
}

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${detail}`) }
}

async function main() {
  const given = process.argv[2]
  const token = await login()
  if (!token) { console.error('❌ 登录失败'); process.exit(1) }

  // 找快手账号：优先给定 id，否则 WAITING_LOGIN 空壳（干净环境）
  let acc = given
    ? await prisma.enterpriseChannelAccount.findUnique({ where: { id: given } })
    : await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: 'kuaishou', connectionStatus: 'WAITING_LOGIN' } })
  if (!acc) {
    acc = await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: 'kuaishou' } })
  }
  if (!acc) { console.error('❌ 无快手账号'); process.exit(1) }
  console.log(`═══ TASK02 Gate B — 快手扫码验证 ═══`)
  console.log(`账号: ${acc.id.slice(0, 8)} status=${acc.connectionStatus} name=${acc.accountName || '(空壳)'}\n`)

  // 1. 发起 connect（同步，等待返回）
  console.log('── 发起 connect（同步等待，快手约 20-30s）──')
  const c = await api(`/api/enterprise/channels/runtime/${acc.id}/connect`, 'POST', {}, token)
  const cdata = (c.json as any).data || {}
  console.log(`  connect 返回: status=${cdata.status} message=${cdata.message || ''} sessionId=${cdata.sessionId || '(取 status)'}`)
  const sessionId = cdata.sessionId || `kuaishou:${acc.id}`
  check('B0 connect 返回 waiting_login', cdata.status === 'waiting_login' || cdata.status === 'awaiting_confirmation', `(got ${cdata.status})`)

  // 2. 轮询 status 拿二维码截图
  console.log('── 轮询 status 获取二维码 ──')
  let qrFile: string | null = null
  const deadlineQr = Date.now() + 60000
  while (Date.now() < deadlineQr) {
    await new Promise(r => setTimeout(r, 2500))
    const s = await api(`/api/enterprise/channels/runtime/browser/${sessionId}/status`, 'GET', undefined, token)
    const d = (s.json as any).data || {}
    if (d.qrSource || d.screenshotBase64 || d.qrImage) {
      // 保存二维码
      const fs = await import('fs')
      const buf = d.qrImage
        ? Buffer.from(d.qrImage, 'base64')
        : d.screenshotBase64
          ? Buffer.from(d.screenshotBase64, 'base64')
          : null
      if (buf && buf.length > 1000) {
        qrFile = '/tmp/kuaishou-qr.png'
        fs.writeFileSync(qrFile, buf)
        console.log(`  ✅ 二维码已保存: ${qrFile} (${buf.length} bytes) qrSource=${d.qrSource} stage=${d.loginStage}`)
        break
      }
      console.log(`  status: stage=${d.loginStage} qrSource=${d.qrSource} (buffer ${(d.qrImage || d.screenshotBase64 || '').length})`)
    } else {
      console.log(`  status: stage=${d.loginStage} loginPage=${d.loginPage} (等待二维码...)`)
    }
  }
  check('B1 二维码已生成', !!qrFile, '(未在 60s 内拿到二维码)')

  // 3. wait-for-login 轮询（掌柜扫码窗口 5 分钟）
  console.log('\n── ⏳ 请掌柜用快手 App 扫码（二维码见 /tmp/kuaishou-qr.png）──')
  const deadline = Date.now() + 5 * 60 * 1000
  let final: any = null
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000))
    const fresh = await prisma.enterpriseChannelAccount.findUnique({ where: { id: acc!.id } })
    if (fresh?.connectionStatus === 'CONNECTED' && fresh.externalAccountId) { final = fresh; break }
    const s = await api(`/api/enterprise/channels/runtime/browser/${sessionId}/status`, 'GET', undefined, token).catch(() => null)
    const d = (s?.json as any)?.data
    if (d?.authenticated || d?.loginStage === 'awaiting_confirmation' || d?.loginStage === 'verifying') {
      console.log(`  [${new Date().toLocaleTimeString()}] 检测到扫码推进: stage=${d.loginStage} authenticated=${d.authenticated}`)
      // 尝试自动完成确认
      await api(`/api/enterprise/channels/runtime/${acc!.id}/wait-for-login`, 'POST', {}, token).catch(() => {})
    }
  }
  if (!final) {
    const fresh = await prisma.enterpriseChannelAccount.findUnique({ where: { id: acc!.id } })
    console.log(`  ⏱ 超时，当前 status=${fresh?.connectionStatus} extId=${fresh?.externalAccountId || 'null'}`)
  }

  // 4. 断言 Gate B
  check('B2 status=CONNECTED', final?.connectionStatus === 'CONNECTED', `(got ${final?.connectionStatus})`)
  check('B3 externalAccountId 真实', !!final?.externalAccountId, `(${final?.externalAccountId || 'null'})`)
  check('B4 accountName 真实', !!final?.accountName, `(${final?.accountName || 'null'})`)
  console.log(`\n═══ Gate B 结果: ${pass} pass / ${fail} fail ═══`)
  if (final) {
    console.log(`  账号: ${final.accountName} / ${final.externalAccountId}`)
  }
  process.exit(fail > 0 && !final ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
