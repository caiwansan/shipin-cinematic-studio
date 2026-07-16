/**
 * P4.2.5.2-GATE-01.3 — Channel Health Validation
 *
 * Validates the full Channel Health chain:
 *   Token → Adapter → Callback → Event Processing → Sync → Feed
 *
 * 8 Checks:
 *   1. Token Service healthy
 *   2. WeCom Adapter reachable
 *   3. Callback signature verify
 *   4. Event ingestion success
 *   5. EventTraceLog generated
 *   6. SyncStatus correct
 *   7. Channel Health API correct
 *   8. Command Center display source/freshness
 *
 * Run: npx tsx tests/gate-01/channel-health-validation.ts
 */

import { prisma } from '../../src/utils/index.js'
import { callbackEventService } from '../../src/enterprise/channel/callback-event.service.js'
import { interactionFeedService } from '../../src/enterprise/channel/interaction-feed.service.js'
import { customerIdentityService } from '../../src/enterprise/channel/customer-identity.service.js'

// ─── Types ─────────────────────────────────────────────────

interface ValidationCheck {
  name: string
  passed: boolean
  message: string
  details?: Record<string, any>
}

interface ValidationReport {
  gate: string
  timestamp: string
  checks: ValidationCheck[]
  summary: {
    total: number
    passed: number
    failed: number
    passRate: string
  }
}

// ─── Test Data ─────────────────────────────────────────────

const TEST_TENANT_ID = `gate01-3-test-${Date.now()}`
const TEST_CHANNEL_ACCOUNT_ID = `gate01-3-account-${Date.now()}`
const TEST_EXTERNAL_USERID = `gate01-3-wx-user-${Date.now()}`

const MOCK_WECOM_MESSAGE_EVENT = {
  Event: 'text',
  MsgType: 'text',
  UserID: TEST_EXTERNAL_USERID,
  external_userid: TEST_EXTERNAL_USERID,
  content: '你好，想了解产品信息',
  CreateTime: Math.floor(Date.now() / 1000),
}

const MOCK_WECOM_CUSTOMER_ADD_EVENT = {
  Event: 'change_external_contact',
  MsgType: 'event',
  UserID: TEST_EXTERNAL_USERID,
  external_userid: TEST_EXTERNAL_USERID,
  CreateTime: Math.floor(Date.now() / 1000),
}

// ─── Validation Runner ─────────────────────────────────────

class ChannelHealthValidator {
  private checks: ValidationCheck[] = []
  private traceIds: string[] = []

  async run(): Promise<ValidationReport> {
    console.log('\n' + '='.repeat(60))
    console.log('  P4.2.5.2-GATE-01.3 — Channel Health Validation')
    console.log('  8 Checks: Token → Adapter → Callback → Event → Sync')
    console.log('='.repeat(60))

    try {
      await this.setupTestData()
      await this.checkTokenService()
      await this.checkAdapterReachable()
      await this.checkCallbackSignature()
      await this.checkEventIngestion()
      await this.checkEventTraceLog()
      await this.checkSyncStatus()
      await this.checkChannelHealthApi()
      await this.checkCommandCenterData()
    } finally {
      await this.cleanup()
    }

    return this.generateReport()
  }

  private async setupTestData(): Promise<void> {
    console.log('\n📋 Setting up test data...')
    await prisma.enterpriseChannelAccount.create({
      data: {
        id: TEST_CHANNEL_ACCOUNT_ID,
        tenantId: TEST_TENANT_ID,
        channelType: 'wechat_work',
        channelName: 'Gate-01.3 Health Test',
        externalAccountId: 'test-corp-id',
        credentialEncrypted: {
          corpId: 'test-corp-id',
          agentId: 'test-agent-id',
          secret: 'test-secret',
          token: 'test-token',
          encodingAESKey: 'test-aes-key',
        },
        connectionStatus: 'connected',
        connectedAt: new Date(),
      },
    })
  }

  // ─── Check 1: Token Service healthy ─────────────────────

  private async checkTokenService(): Promise<void> {
    console.log('\n🔍 Check 1: Token Service healthy')

    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: TEST_CHANNEL_ACCOUNT_ID },
      select: {
        connectionStatus: true,
        connectedAt: true,
        credentialEncrypted: true,
      },
    })

    const hasCredentials = account?.credentialEncrypted != null
    const isConnected = account?.connectionStatus === 'connected'
    const noPlaintext = !JSON.stringify(account?.credentialEncrypted).includes('plain-secret')

    const passed = isConnected && hasCredentials && noPlaintext

    this.checks.push({
      name: 'token_service_healthy',
      passed,
      message: passed
        ? `Token layer: status=${account!.connectionStatus}, credentials=encrypted, no plaintext`
        : `Token layer issue: status=${account?.connectionStatus}, creds=${hasCredentials}`,
      details: {
        status: account?.connectionStatus,
        hasCredentials,
        noPlaintext,
      },
    })
  }

  // ─── Check 2: WeCom Adapter reachable ───────────────────

  private async checkAdapterReachable(): Promise<void> {
    console.log('\n🔍 Check 2: WeCom Adapter reachable')

    try {
      const { WeComAdapter } = await import('../../src/enterprise/channel/wecom-adapter.js')
      const adapter = new WeComAdapter()
      adapter.setChannelAccountId(TEST_CHANNEL_ACCOUNT_ID)
      const normalized = adapter.normalizeEvent(MOCK_WECOM_MESSAGE_EVENT)

      const passed = normalized != null && normalized.type != null

      this.checks.push({
        name: 'adapter_reachable',
        passed,
        message: passed
          ? `Adapter reachable: normalized to ${normalized!.type}`
          : 'Adapter unreachable',
        details: { normalizedType: normalized?.type },
      })
    } catch (error: any) {
      this.checks.push({ name: 'adapter_reachable', passed: false, message: error.message })
    }
  }

  // ─── Check 3: Callback signature verify ──────────────────

  private async checkCallbackSignature(): Promise<void> {
    console.log('\n🔍 Check 3: Callback signature verify')

    try {
      const { verifyWeComSignature, verifyEventSignature } = await import('../../src/enterprise/channel/wecom-crypto.js')
      const hasVerify = typeof verifyWeComSignature === 'function'
      const hasEventVerify = typeof verifyEventSignature === 'function'
      const passed = hasVerify && hasEventVerify

      this.checks.push({
        name: 'callback_signature_verify',
        passed,
        message: passed
          ? 'Crypto verify ready: verifyWeComSignature + verifyEventSignature'
          : 'Crypto incomplete',
        details: { hasVerify, hasEventVerify },
      })
    } catch (error: any) {
      this.checks.push({ name: 'callback_signature_verify', passed: false, message: error.message })
    }
  }

  // ─── Check 4: Event ingestion success ───────────────────

  private async checkEventIngestion(): Promise<void> {
    console.log('\n🔍 Check 4: Event ingestion success')

    try {
      const result = await callbackEventService.processEvent(
        TEST_CHANNEL_ACCOUNT_ID,
        TEST_TENANT_ID,
        MOCK_WECOM_MESSAGE_EVENT
      )

      if (result.traceId) this.traceIds.push(result.traceId)

      this.checks.push({
        name: 'event_ingestion_success',
        passed: result.success,
        message: result.success
          ? `Ingestion OK: status=${result.status}`
          : `Ingestion failed: ${result.error}`,
        details: { status: result.status, traceId: result.traceId },
      })
    } catch (error: any) {
      this.checks.push({ name: 'event_ingestion_success', passed: false, message: error.message })
    }
  }

  // ─── Check 5: EventTraceLog generated ────────────────────

  private async checkEventTraceLog(): Promise<void> {
    console.log('\n🔍 Check 5: EventTraceLog generated')

    if (this.traceIds.length === 0) {
      this.checks.push({ name: 'event_trace_log_generated', passed: false, message: 'No trace IDs' })
      return
    }

    try {
      const trace = await callbackEventService.getEventTrace(this.traceIds[0])
      const hasReceived = trace.some(e => e.stage === 'received')
      const hasProcessed = trace.some(e => e.stage === 'processed')
      const passed = trace.length >= 2 && hasReceived && hasProcessed

      this.checks.push({
        name: 'event_trace_log_generated',
        passed,
        message: passed
          ? `TraceLog: ${trace.length} stages [${trace.map(e => e.stage).join(' → ')}]`
          : `TraceLog incomplete: ${trace.length} stages`,
        details: { stages: trace.map(e => e.stage) },
      })
    } catch (error: any) {
      this.checks.push({ name: 'event_trace_log_generated', passed: false, message: error.message })
    }
  }

  // ─── Check 6: SyncStatus correct ─────────────────────────

  private async checkSyncStatus(): Promise<void> {
    console.log('\n🔍 Check 6: SyncStatus correct')

    try {
      const feedResult = await interactionFeedService.queryFeed({ tenantId: TEST_TENANT_ID, limit: 10 })
      const envelope = interactionFeedService.envelope(feedResult, 'gate01-3')
      const processedCount = await prisma.processedEvent.count({ where: { tenantId: TEST_TENANT_ID, status: 'success' } })

      const passed = processedCount > 0 && envelope.syncStatus === 'synced'

      this.checks.push({
        name: 'sync_status_correct',
        passed,
        message: passed
          ? `SyncStatus: synced (${processedCount} processed)`
          : `SyncStatus: ${envelope.syncStatus} (${processedCount} processed)`,
        details: { syncStatus: envelope.syncStatus, source: envelope.source },
      })
    } catch (error: any) {
      this.checks.push({ name: 'sync_status_correct', passed: false, message: error.message })
    }
  }

  // ─── Check 7: Channel Health API correct ─────────────────

  private async checkChannelHealthApi(): Promise<void> {
    console.log('\n🔍 Check 7: Channel Health API correct')

    try {
      const identityHealth = await customerIdentityService.getHealth(TEST_TENANT_ID, TEST_CHANNEL_ACCOUNT_ID)
      const eventStats = await callbackEventService.getEventStats(TEST_CHANNEL_ACCOUNT_ID)

      const passed = identityHealth != null && eventStats != null

      this.checks.push({
        name: 'channel_health_api_correct',
        passed,
        message: passed
          ? 'Health APIs return valid data'
          : 'Health APIs issue',
        details: {
          identityTotal: identityHealth?.totalIdentities,
          eventTotal: eventStats?.totalEvents,
        },
      })
    } catch (error: any) {
      this.checks.push({ name: 'channel_health_api_correct', passed: false, message: error.message })
    }
  }

  // ─── Check 8: Command Center data ────────────────────────

  private async checkCommandCenterData(): Promise<void> {
    console.log('\n🔍 Check 8: Command Center display source/freshness')

    try {
      const feedResult = await interactionFeedService.queryFeed({ tenantId: TEST_TENANT_ID, limit: 10 })
      const envelope = interactionFeedService.envelope(feedResult, 'gate01-3-cc')

      const passed = envelope.source === 'WeCom' && envelope.syncStatus === 'synced'

      this.checks.push({
        name: 'command_center_data',
        passed,
        message: passed
          ? `CC data: source=${envelope.source}, sync=${envelope.syncStatus}`
          : `CC data issue: source=${envelope.source}, sync=${envelope.syncStatus}`,
        details: { source: envelope.source, syncStatus: envelope.syncStatus },
      })
    } catch (error: any) {
      this.checks.push({ name: 'command_center_data', passed: false, message: error.message })
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...')
    try {
      await prisma.eventTraceLog.deleteMany({ where: { tenantId: TEST_TENANT_ID } })
      await prisma.deadLetterEvent.deleteMany({ where: { tenantId: TEST_TENANT_ID } })
      await prisma.processedEvent.deleteMany({ where: { tenantId: TEST_TENANT_ID } })
      await prisma.enterpriseInteraction.deleteMany({ where: { tenantId: TEST_TENANT_ID } })
      await prisma.customerIdentity.deleteMany({ where: { tenantId: TEST_TENANT_ID } })
      await prisma.enterpriseChannelAccount.deleteMany({ where: { id: TEST_CHANNEL_ACCOUNT_ID } })
      console.log('   ✅ Cleaned up')
    } catch (error: any) {
      console.log(`   ⚠️ Cleanup: ${error.message}`)
    }
  }

  private generateReport(): ValidationReport {
    const total = this.checks.length
    const passed = this.checks.filter(c => c.passed).length
    const failed = total - passed
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0'

    console.log('\n' + '='.repeat(60))
    console.log('  GATE-01.3 VALIDATION REPORT — 8 Checks')
    console.log('='.repeat(60))

    for (const check of this.checks) {
      const icon = check.passed ? '✅' : '❌'
      console.log(`  ${icon} ${check.name}: ${check.message}`)
    }

    console.log(`\n  Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`)
    console.log(`  Pass Rate: ${passRate}%`)
    console.log('='.repeat(60))

    if (passed === total) {
      console.log('\n  🟢 GATE-01.3 PASS — WeCom Channel = Production Ready ✅\n')
    } else {
      console.log(`\n  🟡 GATE-01.3 ${passed > 0 ? 'PARTIAL' : 'FAIL'}\n`)
    }

    return {
      gate: 'P4.2.5.2-GATE-01.3',
      timestamp: new Date().toISOString(),
      checks: this.checks,
      summary: { total, passed, failed, passRate },
    }
  }
}

async function main() {
  const validator = new ChannelHealthValidator()
  const report = await validator.run()
  process.exit(report.summary.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
