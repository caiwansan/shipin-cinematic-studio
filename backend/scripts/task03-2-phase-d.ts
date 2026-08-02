/**
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — AI 员工渠道权限隔离 Reality Test
 * 链路：AgentChannelBinding(permissions) → ChannelService.authorizeAgentAction → fetchMetrics/publish
 * 规则：Adapter=手脚 ｜ ChannelService=大脑 ｜ AgentChannelBinding=权限系统
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { agentChannelBindingService } from '../src/services/enterprise/agent-channel-binding.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { prisma } from '../src/utils/index.js'

let pass = 0, fail = 0
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${detail ? '→ ' + detail : ''}`) }
}

async function main() {
  // 注册 adapter（模拟 index.ts；独立进程需手动注册）
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))
  // 0. 清理历史残留（previous run 失败中断可能残留）
  const stale = await prisma.enterpriseChannelAccount.findMany({ where: { externalAccountId: { startsWith: 'phase-d-' } }, select: { id: true } })
  if (stale.length) {
    await prisma.agentChannelBinding.deleteMany({ where: { channelAccountId: { in: stale.map(x => x.id) } } })
    await prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: stale.map(x => x.id) } } })
    console.log(`  清理残留: ${stale.length} accounts`)
  }

  const tenantId = 'phase-d-' + Date.now()
  console.log(`\n=== Phase D: AI 员工渠道权限隔离（tenant=${tenantId}）===`)

  // 0. 准备：真实 agent 实例（Alice 语义：用现有 active 实例）
  const agent = await prisma.enterpriseAgentInstance.findFirst({ where: { runtimeStatus: 'active' } })
  if (!agent) throw new Error('无 active agent 实例')
  console.log(`  Agent: ${agent.agentId} (${agent.id})`)

  // 1. 创建测试渠道账号（用 agent 的真实 tenant，满足 createBinding 同租户校验）
  const account = await channelService.connectAccount({
    tenantId: agent.tenantId,
    platform: 'douyin',
    accountName: 'PhaseD 测试抖音号',
    externalAccountId: 'phase-d-' + Date.now(),
    credential: { cookieData: '[]' },
  })
  console.log(`  ChannelAccount: ${account.id}`)

  // 2. 创建绑定：read/analyze=true, publish=false
  const binding = await agentChannelBindingService.createBinding({
    tenantId: agent.tenantId,
    agentInstanceId: agent.id,
    channelAccountId: account.id,
    permissions: { read: true, analyze: true, publish: false },
  } as any)
  console.log(`  Binding: ${binding.id} → {read:true, analyze:true, publish:false}`)

  // 3. G5a: fetchMetrics（analyze 权限）→ 允许（权限层放行；实际抓取无凭证会报无凭证错，但权限已过）
  console.log('\n  [G5a] fetchMetrics with agent (analyze=true):')
  try {
    await channelService.fetchMetrics(account.id, { agentInstanceId: agent.id })
    assert('analyze 权限放行（进入 adapter 执行层）', true)
  } catch (e: any) {
    assert('analyze 权限放行（进入 adapter 执行层）', e.code !== 'permission_denied', e.message)
  }

  // 4. G5b: publish（publish=false）→ 必须 permission_denied
  console.log('\n  [G5b] publish with agent (publish=false):')
  try {
    await channelService.publishWithPermission(account.id, { title: 't', body: 'b', platform: 'douyin' } as any, { agentInstanceId: agent.id })
    assert('publish 被拒绝 permission_denied', false, '竟然放行了！')
  } catch (e: any) {
    assert('publish 被拒绝 permission_denied', e.code === 'permission_denied', e.message)
  }

  // 5. G5c: 未绑定 agent → binding_not_found 拒绝
  console.log('\n  [G5c] 未绑定 agent:')
  try {
    await channelService.publishWithPermission(account.id, { title: 't', body: 'b', platform: 'douyin' } as any, { agentInstanceId: 'no-such-agent' })
    assert('未绑定 agent 被拒绝', false)
  } catch (e: any) {
    assert('未绑定 agent 被拒绝（binding_not_found）', e.code === 'permission_denied' && e.message.includes('binding_not_found'), e.message)
  }

  // 6. G5d: 修改 publish:true → 允许（权限层放行；adapter 仍返回 Task03 禁用，属产品禁令非权限问题）
  console.log('\n  [G5d] updateBinding publish:true:')
  await agentChannelBindingService.updateBinding(agent.tenantId, binding.id, { permissions: { read: true, analyze: true, publish: true } } as any)
  const authAfter = await agentChannelBindingService.authorize(agent.id, account.id, 'publish')
  assert('publish 权限放行（allowed:true）', authAfter.allowed === true, JSON.stringify(authAfter))

  // 7. G5e: 权限放行后 publish 进入 adapter 执行层 → 返回 Task03 阶段禁用（产品禁令，非权限问题）
  const pubResult = await channelService.publishWithPermission(account.id, { title: 't', body: 'b', platform: 'douyin' } as any, { agentInstanceId: agent.id })
  assert('权限放行后 adapter 执行层响应（Task03 禁用，非 permission_denied）', pubResult.status === 'failed' && !(pubResult as any).code, JSON.stringify(pubResult).slice(0, 100))

  // 8. G5f: binding paused → 拒绝
  console.log('\n  [G5f] binding paused:')
  await prisma.agentChannelBinding.update({ where: { id: binding.id }, data: { status: 'paused' } })
  try {
    await channelService.fetchMetrics(account.id, { agentInstanceId: agent.id })
    assert('paused binding 被拒绝', false)
  } catch (e: any) {
    assert('paused binding 被拒绝（binding_paused）', e.code === 'permission_denied' && e.message.includes('binding_paused'), e.message)
  }

  // 9. 清理
  await prisma.agentChannelBinding.delete({ where: { id: binding.id } }).catch(() => {})
  await prisma.enterpriseChannelAccount.delete({ where: { id: account.id } }).catch(() => {})
  console.log(`\n  RESULT: ${pass} PASS / ${fail} FAIL`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })
