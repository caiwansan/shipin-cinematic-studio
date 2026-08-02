import { prisma } from '../src/utils/index.js'
async function main() {
  console.log('═══ 一、账号与电脑现状 ═══')
  const accounts = await prisma.enterpriseChannelAccount.findMany({ orderBy: { updatedAt: 'desc' } })
  for (const a of accounts) {
    const meta: any = a.metadata || {}
    console.log(`- [${a.id.slice(0,8)}] ${a.channelType} "${a.channelName}" 连接=${a.connectionStatus} 账号=${a.accountName || '∅'} extId=${a.externalAccountId || '∅'} via=${meta.via || '-'} updated=${a.updatedAt.toISOString().slice(0,16)}`)
  }
  const ws = await prisma.browserWorkspace.findMany()
  console.log(`\nworkspace 总数: ${ws.length}`)
  for (const w of ws) console.log(`- [${w.id.slice(0,8)}] account=${w.channelAccountId?.slice(0,8)} status=${w.status} biz=${w.businessType} path=${(w.profilePath||'').slice(0,60)}`)

  console.log('\n═══ 二、假数据审计 ═══')
  const fakeNamedAccounts = await prisma.enterpriseChannelAccount.findMany({ where: { OR: [{ channelName: { contains: 'demo' } }, { channelName: { contains: '测试' } }, { channelName: { contains: 'TEST' } }, { channelName: { contains: 'test' } }] } })
  console.log(`1. 账号表 含 demo/测试 命名: ${fakeNamedAccounts.length}`)
  for (const a of fakeNamedAccounts) console.log(`   - [${a.id.slice(0,8)}] ${a.channelType} "${a.channelName}" ${a.connectionStatus} extId=${a.externalAccountId || '∅'}`)
  const fakeNamedWs = await prisma.browserWorkspace.findMany({ where: { OR: [{ profilePath: { contains: 'test' } }, { profilePath: { contains: 'demo' } }, { profilePath: { contains: 'tmp' } }] } })
  console.log(`2. workspace 表 含 test/demo/tmp 路径: ${fakeNamedWs.length}`)
  for (const w of fakeNamedWs) console.log(`   - [${w.id.slice(0,8)}] path=${w.profilePath} status=${w.status} account=${w.channelAccountId?.slice(0,8)}`)
  const agents = await prisma.enterpriseAgentInstance.findMany({ select: { id: true, employeeId: true, agentId: true, runtimeStatus: true, metadata: true } })
  console.log(`\n3. AI 员工: ${agents.length}`)
  for (const ag of agents) console.log(`   - [${ag.id.slice(0,8)}] emp=${ag.employeeId?.slice(0,8)} agent=${ag.agentId?.slice(0,8)} runtime=${ag.runtimeStatus} meta=${JSON.stringify(ag.metadata||{}).slice(0,90)}`)
  const bindings = await prisma.agentChannelBinding.findMany()
  console.log(`\n4. AI员工-账号绑定: ${bindings.length}`)
  for (const b of bindings) console.log(`   - agent=${b.agentInstanceId?.slice(0,8)} → channel=${b.channelAccountId?.slice(0,8)} ws=${b.browserWorkspaceId?.slice(0,8)} status=${b.status} perms=${JSON.stringify(b.permissions)}`)
  const snaps = await prisma.channelMetricSnapshot.findMany({ select: { id: true, channelAccountId: true, workspaceId: true, status: true, source: true, collectedAt: true } })
  console.log(`\n5. 指标快照: ${snaps.length}`)
  for (const s of snaps) console.log(`   - account=${s.channelAccountId?.slice(0,8)} ws=${s.workspaceId?.slice(0,8) || '∅'} status=${s.status} source=${s.source} at=${s.collectedAt.toISOString().slice(0,16)}`)
  const health = await prisma.channelHealthState.findMany()
  console.log(`\n6. 健康状态: ${health.length}`)
  for (const h of health) console.log(`   - account=${h.channelAccountId?.slice(0,8)} state=${h.state} fail=${h.failureCount}`)
  const ops = await prisma.channelOperationLog.findMany()
  console.log(`\n7. 操作日志: ${ops.length}`)
  for (const o of ops.slice(0, 30)) console.log(`   - account=${o.channelAccountId?.slice(0,8)} type=${o.type} status=${o.status} at=${o.createdAt.toISOString().slice(0,16)} meta=${JSON.stringify(o.metadata||{}).slice(0,80)}`)
  console.log('\n8. 全库模拟标记扫描:')
  for (const t of ['channelMetricSnapshot', 'channelOperationLog', 'channelIdentitySnapshot', 'channelHealthState']) {
    const rows: any = await (prisma as any)[t].findMany()
    const fake = rows.filter((r: any) => /simulat|mock|fake|demo-token/i.test(JSON.stringify(r)))
    console.log(`   - ${t}: ${rows.length} 行, 含模拟标记 ${fake.length} 行`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
