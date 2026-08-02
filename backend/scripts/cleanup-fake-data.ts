/**
 * REALITY-GATE-FINAL-01 Task03 — 历史假数据清理（v2 修正 KEEP 真实 ID）
 * 原则：真实 或者 不存在（不能有「模拟成功」）
 * 已备份：data/backups/reality-gate-final-01/fake-data-removal-backup.sql
 */
import { prisma } from '../src/utils/index.js'

const KEEP_ACCOUNT_IDS = new Set([
  '08a0f643-fb0d-48d5-af18-ad87bd9a34fb', // 南坡万（真实扫码，抖音黄金样板）
  '10e0ea29-3a20-4aae-9efc-8557b86daa0c', // 骏霄数字科技（快手，真实扫码）
  'c4a1b25f-902e-4c17-9846-c5ad9bab6be0', // 郑州骏霄数字科技有限公司（视频号，真实扫码）
])

async function main() {
  const accounts = await prisma.enterpriseChannelAccount.findMany()
  const toDelete = accounts.filter(a => !KEEP_ACCOUNT_IDS.has(a.id))
  console.log(`账号总数 ${accounts.length}，保留 ${accounts.length - toDelete.length}，待删 ${toDelete.length}`)
  for (const a of toDelete) {
    const meta: any = a.metadata || {}
    console.log(`  - 删账号 [${a.id.slice(0,8)}] ${a.channelType} "${a.channelName}" status=${a.connectionStatus} extId=${a.externalAccountId || '∅'} via=${meta.via || '-'}`)
  }

  const ids = toDelete.map(a => a.id)
  const ws = await prisma.browserWorkspace.findMany({ where: { channelAccountId: { in: ids } } })
  const wsIds = ws.map(w => w.id)
  console.log(`\n级联 workspace: ${ws.length} 个`)
  for (const w of ws) console.log(`  - 删workspace [${w.id.slice(0,8)}] account=${w.channelAccountId?.slice(0,8)} status=${w.status}`)

  const del = async (name: string, fn: () => Promise<any>) => {
    const r = await fn()
    console.log(`  - 删 ${name}: ${r.count} 行`)
  }
  if (wsIds.length) await del('workspace', () => prisma.browserWorkspace.deleteMany({ where: { id: { in: wsIds } } }))
  await del('绑定', () => prisma.agentChannelBinding.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('指标快照', () => prisma.channelMetricSnapshot.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('健康状态', () => prisma.channelHealthState.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('操作日志', () => prisma.channelOperationLog.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('验证会话', () => prisma.channelVerificationSession.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('浏览器会话', () => prisma.channelBrowserSession.deleteMany({ where: { channelAccountId: { in: ids } } }))
  await del('账号', () => prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: ids } } }))
  console.log('\n✅ 清理完成')
}
main().catch(e => { console.error(e); process.exit(1) })
