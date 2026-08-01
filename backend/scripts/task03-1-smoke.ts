/**
 * Task03.1 Reality Smoke Test — 创建测试抖音渠道账号（AES 加密落库）
 * 验证：connectAccount 加密 → Runtime 路由链路
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'

async function main() {
  // 模拟 index.ts 注册（Credential 注入回调 → EnterpriseChannelService AES 层）
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (accountId) => channelService.getCredential(accountId),
    persistCredential: (accountId, credential) => channelService.updateCredential(accountId, credential),
  }))
  // 1. 创建抖音渠道账号（真实 AES-256-GCM 加密）
  const account = await channelService.connectAccount({
    tenantId: `reality-test-${Date.now()}`,
    organizationId: null,
    platform: 'douyin',
    accountName: 'Reality Test 抖音号',
    externalAccountId: `reality-test-${Date.now()}`,
    credential: {
      // 测试凭证（无真实 cookie，仅验证链路；真实登录后 refresh-credential 回写）
      cookieData: '[]',
      note: 'smoke-test',
    },
  })
  console.log('ACCOUNT_CREATED:', account.id)
  console.log('ENCRYPTED_PAYLOAD:', JSON.stringify((account as any).credentialEncrypted).slice(0, 60))

  // 2. 验证解密可读（getCredential）
  const cred = await channelService.getCredential(account.id)
  console.log('DECRYPT_OK:', Object.keys(cred))

  // 3. resolveAdapter 解析（channelType=douyin → DouyinBrowserAdapter）
  const adapter = channelService.resolveAdapter('douyin')
  console.log('ADAPTER_RESOLVED:', adapter.constructor.name, '| platform:', adapter.platform)

  // 4. 健康检查（Chromium 可启动性）
  const health = await adapter.healthCheck()
  console.log('HEALTH:', JSON.stringify(health))

  // 5. connect 尝试（打开抖音创作者中心；无真实登录态 → waiting_login 预期）
  try {
    const connectResult = await channelService.connectChannel(account.id)
    console.log('CONNECT_RESULT:', JSON.stringify(connectResult).slice(0, 150))
  } catch (e: any) {
    console.log('CONNECT_FAILED:', e.message)
  }

  process.exit(0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })

// 6. refresh-credential（登录态回写：浏览器 cookie → AES 落库）
// 注：无真实登录，预期 ok:false（无 cookie）或 ok:true（会话 cookie 回写）
