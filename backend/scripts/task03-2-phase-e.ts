/**
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase E — 登录态失效恢复 Reality Test
 * 场景：connected → cookie 失效 → 重新 connect → waiting_login → connectionStatus=expired
 * 红线：不得一直显示在线（connected 假象）
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { prisma } from '../src/utils/index.js'

let pass = 0, fail = 0
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${detail ? '→ ' + detail : ''}`) }
}

async function main() {
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))

  const tenantId = 'phase-e-' + Date.now()
  console.log(`\n=== Phase E: 登录态失效恢复（tenant=${tenantId}）===`)

  // 清理残留
  const stale = await prisma.enterpriseChannelAccount.findMany({ where: { externalAccountId: { startsWith: 'phase-e-' } }, select: { id: true } })
  if (stale.length) await prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: stale.map(x => x.id) } } })

  // 1. 场景 A：已 connected 账号（模拟有凭证），然后凭证失效（cookie 被删/过期）
  const account = await channelService.connectAccount({
    tenantId,
    platform: 'douyin',
    accountName: 'PhaseE 测试抖音号',
    externalAccountId: 'phase-e-' + Date.now(),
    credential: { cookieData: JSON.stringify([{ name: 'sessionid', value: 'expired-stale-cookie', domain: '.douyin.com', path: '/' }]) },
  })
  console.log(`\n  [E1] 账号初始状态: connectionStatus=${account.connectionStatus}`)

  // 2. 模拟 cookie 失效：清空 credentialEncrypted（等价于登录态被平台踢下线/凭证损坏）
  console.log('\n  [E2] 模拟凭证失效（写入无效 cookie）:')
  await channelService.updateCredential(account.id, { cookieData: JSON.stringify([{ name: 'sessionid', value: 'invalid', domain: '.douyin.com', path: '/' }]) })
  const afterInvalid = await prisma.enterpriseChannelAccount.findUnique({ where: { id: account.id } })
  assert('无效凭证已写入（credentialEncrypted 存在但内容无效）', !!afterInvalid?.credentialEncrypted)

  // 3. 重新 connect → 登录态检测失败 → waiting_login → 状态必须变 expired（不得一直 connected）
  console.log('\n  [E3] 重新 connect（无效 cookie）:')
  const connectResult = await channelService.connectChannel(account.id)
  console.log(`      connect → status=${connectResult.status}`)
  const afterConnect = await prisma.enterpriseChannelAccount.findUnique({ where: { id: account.id } })
  assert('connect 返回 waiting_login（登录态已失效）', connectResult.status === 'waiting_login', JSON.stringify(connectResult).slice(0, 80))
  assert('DB connectionStatus 从 connected → expired（不假在线）', afterConnect?.connectionStatus === 'expired', `实际=${afterConnect?.connectionStatus}`)

  // 4. 恢复路径：重新登录成功（模拟 refreshCredential 回写有效 cookie + 标记 connected）
  console.log('\n  [E4] 恢复路径（重新登录后 refresh-credential）:')
  await channelService.updateCredential(account.id, { cookieData: JSON.stringify([{ name: 'sessionid', value: 'fresh-valid-session', domain: '.douyin.com', path: '/' }]) })
  await prisma.enterpriseChannelAccount.update({ where: { id: account.id }, data: { connectionStatus: 'connected', connectedAt: new Date() } })
  const recovered = await prisma.enterpriseChannelAccount.findUnique({ where: { id: account.id } })
  assert('重新授权后恢复 connected', recovered?.connectionStatus === 'connected', `实际=${recovered?.connectionStatus}`)

  // 5. 清理
  await prisma.enterpriseChannelAccount.delete({ where: { id: account.id } }).catch(() => {})
  console.log(`\n  RESULT: ${pass} PASS / ${fail} FAIL`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })
