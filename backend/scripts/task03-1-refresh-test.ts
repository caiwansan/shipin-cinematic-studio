/**
 * Task03.1 refresh-credential 流程验证 + 测试数据清理
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { prisma } from '../src/utils/index.js'

async function main() {
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))

  const acc = await channelService.connectAccount({
    tenantId: 'rt-' + Date.now(),
    platform: 'douyin',
    accountName: 'rt',
    externalAccountId: 'rt-' + Date.now(),
    credential: { cookieData: '[]' },
  })
  const r = await channelService.refreshChannelCredential(acc.id)
  console.log('REFRESH_RESULT:', JSON.stringify(r))

  await prisma.enterpriseChannelAccount.deleteMany({
    where: { OR: [{ id: acc.id }, { tenantId: { startsWith: 'reality-test-' } }, { tenantId: { startsWith: 'rt-' } }] },
  })
  console.log('CLEANUP_OK')
  process.exit(0)
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
