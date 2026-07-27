// ============================================================
// Credential Lifecycle Service — AI Runtime Engine v1.0
// ============================================================
// SSOT: 所有 Credential 运行时状态必须通过此 Service 管理。
// 不允许任何地方直接写入 lifecycleStatus。
// ============================================================

import { getEncryptionGuardResult } from '../../services/geo/runtime/encryption-guard.js'

export enum CredentialLifecycleStatus {
  NEW = 'NEW',
  VALIDATING = 'VALIDATING',
  ACTIVE = 'ACTIVE',
  INVALID = 'INVALID',
  REQUIRES_RECONFIGURATION = 'REQUIRES_RECONFIGURATION',
  DISABLED = 'DISABLED',
}

export interface CredentialLifecycleEntry {
  id: string
  provider: string
  ownerType: string
  ownerId: string
  lifecycleStatus: string
  credentialSourceType: string | null
  credentialSourceId: string | null
  lastValidatedAt: Date | null
  lastSuccessAt: Date | null
  lastFailureAt: Date | null
  failureReason: string | null
  failureCode: string | null
  validationCount: number
  consecutiveFailures: number
  createdAt: Date
  updatedAt: Date
}

export interface RuntimeSummaryResult {
  runtimeReady: boolean
  readinessScore: number
  providers: number
  totalCredentials: number
  healthyCredentials: number
  healthy: number
  reconfigurationRequired: number
  credentialLifecycle: {
    active: number
    invalid: number
    requiresReconfiguration: number
    disabled: number
  }
  lastValidation: string | null
}

// 状态权重（用于 readinessScore 计算）
const STATUS_WEIGHTS: Record<string, number> = {
  [CredentialLifecycleStatus.ACTIVE]: 100,
  [CredentialLifecycleStatus.VALIDATING]: 50,
  [CredentialLifecycleStatus.NEW]: 30,
  [CredentialLifecycleStatus.INVALID]: 20,
  [CredentialLifecycleStatus.REQUIRES_RECONFIGURATION]: 10,
  [CredentialLifecycleStatus.DISABLED]: 0,
}

// 状态转换规则表
const ALLOWED_TRANSITIONS: Record<CredentialLifecycleStatus, CredentialLifecycleStatus[]> = {
  [CredentialLifecycleStatus.NEW]: [
    CredentialLifecycleStatus.VALIDATING,
    CredentialLifecycleStatus.DISABLED,
  ],
  [CredentialLifecycleStatus.VALIDATING]: [
    CredentialLifecycleStatus.ACTIVE,
    CredentialLifecycleStatus.INVALID,
    CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
  ],
  [CredentialLifecycleStatus.ACTIVE]: [
    CredentialLifecycleStatus.INVALID,
    CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
    CredentialLifecycleStatus.DISABLED,
  ],
  [CredentialLifecycleStatus.INVALID]: [
    CredentialLifecycleStatus.VALIDATING,
    CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
    CredentialLifecycleStatus.DISABLED,
  ],
  [CredentialLifecycleStatus.REQUIRES_RECONFIGURATION]: [
    CredentialLifecycleStatus.VALIDATING,
    CredentialLifecycleStatus.NEW,
  ],
  [CredentialLifecycleStatus.DISABLED]: [
    // 只能通过管理员操作从 UI 层面解除禁用
  ],
}

export class CredentialLifecycleService {
  constructor(private prisma: any) {}

  /**
   * 安全转换状态。
   * 校验转换合法性，记录原因和时间戳。
   */
  async transition(
    ownerType: string,
    ownerId: string,
    provider: string,
    to: CredentialLifecycleStatus,
    meta?: { reason?: string; code?: string },
  ): Promise<void> {
    // 获取当前状态
    const current = await this.getEntry(ownerType, ownerId, provider)
    const fromStatus = current?.lifecycleStatus ?? CredentialLifecycleStatus.NEW

    const allowed = ALLOWED_TRANSITIONS[fromStatus as CredentialLifecycleStatus]
    if (!allowed || !allowed.includes(to)) {
      throw new Error(
        `Illegal transition: ${fromStatus} → ${to} for ${ownerType}:${ownerId}/${provider}. ` +
        `Allowed from ${fromStatus}: [${allowed?.join(', ') || 'none'}]`,
      )
    }

    const now = new Date()
    const updateData: any = {
      lifecycleStatus: to,
      updatedAt: now,
    }

    // 记录时间戳
    updateData.lastValidatedAt = now
    if (to === CredentialLifecycleStatus.ACTIVE) {
      updateData.lastSuccessAt = now
      updateData.consecutiveFailures = 0
    }
    if (
      to === CredentialLifecycleStatus.INVALID ||
      to === CredentialLifecycleStatus.REQUIRES_RECONFIGURATION
    ) {
      updateData.lastFailureAt = now
      if (meta?.reason) updateData.failureReason = meta.reason
      if (meta?.code) updateData.failureCode = meta.code
    }

    await this.prisma.credentialRuntimeState.upsert({
      where: { ownerType_ownerId_provider: { ownerType, ownerId, provider } },
      update: updateData,
      create: {
        provider,
        ownerType,
        ownerId,
        lifecycleStatus: to,
        ...(meta?.reason ? { failureReason: meta.reason } : {}),
        ...(meta?.code ? { failureCode: meta.code } : {}),
        lastValidatedAt: now,
        ...(to === CredentialLifecycleStatus.ACTIVE ? { lastSuccessAt: now } : {}),
        ...(
          to === CredentialLifecycleStatus.INVALID || to === CredentialLifecycleStatus.REQUIRES_RECONFIGURATION
            ? { lastFailureAt: now }
            : {}
        ),
      },
    })
  }

  /**
   * 获取单条状态
   */
  async getStatus(ownerType: string, ownerId: string, provider: string): Promise<CredentialLifecycleStatus> {
    const entry = await this.getEntry(ownerType, ownerId, provider)
    return (entry?.lifecycleStatus ?? CredentialLifecycleStatus.NEW) as CredentialLifecycleStatus
  }

  /**
   * 获取某个用户/组织的所有 Credential 状态
   */
  async getAllForOwner(ownerType: string, ownerId: string): Promise<CredentialLifecycleEntry[]> {
    const entries = await this.prisma.credentialRuntimeState.findMany({
      where: { ownerType, ownerId },
      orderBy: { updatedAt: 'desc' },
    })
    return entries.map((e: any) => this.mapEntry(e))
  }

  /**
   * 启动时初始化：扫描所有 ApiKey + UserModelConfigV2，创建对应的 CredentialRuntimeState
   * - 从 ApiKey 表读取所有平台凭据 → ownerType='platform', ownerId='platform'
   * - 从 UserModelConfigV2 表读取所有用户凭据 → ownerType='user', ownerId=userId
   * - 检查 Encryption Guard 结果，decrypt_failed 的密钥初始化为 REQUIRES_RECONFIGURATION
   */
  async initializeFromExisting(prisma: any): Promise<void> {
    console.log('[CredentialLifecycle] ⏳ Initializing from existing credentials...')
    let created = 0

    // 1. 扫描 ApiKey 表（platform-level）
    try {
      const platformKeys = await prisma.apiKey.findMany()
      for (const key of platformKeys) {
        const existing = await this.getEntry('platform', 'platform', key.provider)
        if (!existing) {
          // 检查 encryption guard 结果
          const guardResult = getEncryptionGuardResult()
          const isFailed = guardResult?.details?.some(
            (d) => d.source === `ApiKey:${key.provider}` && d.status === 'failed',
          )

          await this.prisma.credentialRuntimeState.create({
            data: {
              provider: key.provider,
              ownerType: 'platform',
              ownerId: 'platform',
              lifecycleStatus: isFailed
                ? CredentialLifecycleStatus.REQUIRES_RECONFIGURATION
                : CredentialLifecycleStatus.NEW,
              credentialSourceType: 'ApiKey',
              credentialSourceId: key.id,
              ...(isFailed ? { failureReason: 'Decryption failed at startup', failureCode: 'DECRYPT_FAILED' } : {}),
            },
          })
          created++
        }
      }
    } catch (err: any) {
      console.warn('[CredentialLifecycle] ⚠️ Could not scan ApiKey table:', err.message)
    }

    // 2. 扫描 UserModelConfigV2 表
    try {
      const userConfigs = await prisma.userModelConfigV2.findMany()
      const guardResult = getEncryptionGuardResult()
      const failedUserIds = new Set<string>()
      if (guardResult) {
        for (const detail of guardResult.details) {
          if (detail.source.startsWith('UserModelConfigV2:') && detail.status === 'failed') {
            const userId = detail.source.replace('UserModelConfigV2:', '')
            failedUserIds.add(userId)
          }
        }
      }

      const providerFields: Array<{ provider: string; keyExtractor: (cfg: any) => string | null }> = [
        { provider: 'llm', keyExtractor: (cfg) => cfg.llmApiKey },
        { provider: 'image', keyExtractor: (cfg) => cfg.imageApiKey },
        { provider: 'video', keyExtractor: (cfg) => cfg.videoApiKey },
        { provider: 'tts', keyExtractor: (cfg) => cfg.ttsApiKey },
      ]

      for (const config of userConfigs) {
        for (const { provider, keyExtractor } of providerFields) {
          const apiKey = keyExtractor(config)
          if (!apiKey) continue // 未配置该 provider 的 key

          const existing = await this.getEntry('user', config.userId, provider)
          if (!existing) {
            const isFailed = failedUserIds.has(config.userId)

            await this.prisma.credentialRuntimeState.create({
              data: {
                provider,
                ownerType: 'user',
                ownerId: config.userId,
                lifecycleStatus: isFailed
                  ? CredentialLifecycleStatus.REQUIRES_RECONFIGURATION
                  : CredentialLifecycleStatus.NEW,
                credentialSourceType: 'UserModelConfigV2',
                credentialSourceId: config.userId,
                ...(isFailed ? { failureReason: 'Decryption failed at startup', failureCode: 'DECRYPT_FAILED' } : {}),
              },
            })
            created++
          }
        }
      }
    } catch (err: any) {
      console.warn('[CredentialLifecycle] ⚠️ Could not scan UserModelConfigV2 table:', err.message)
    }

    console.log(`[CredentialLifecycle] ✅ Initialized ${created} credential runtime states`)
  }

  /**
   * Runtime Summary — 汇总所有 Credential 状态
   */
  async getSummary(): Promise<RuntimeSummaryResult> {
    let allEntries: CredentialLifecycleEntry[] = []

    try {
      allEntries = (await this.prisma.credentialRuntimeState.findMany()).map((e: any) => this.mapEntry(e))
    } catch {
      // 表不存在
    }

    const total = allEntries.length
    const active = allEntries.filter((e) => e.lifecycleStatus === CredentialLifecycleStatus.ACTIVE).length
    const invalid = allEntries.filter((e) => e.lifecycleStatus === CredentialLifecycleStatus.INVALID).length
    const requiresReconfig = allEntries.filter(
      (e) => e.lifecycleStatus === CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
    ).length
    const disabled = allEntries.filter((e) => e.lifecycleStatus === CredentialLifecycleStatus.DISABLED).length
    const validating = allEntries.filter((e) => e.lifecycleStatus === CredentialLifecycleStatus.VALIDATING).length
    const newCount = allEntries.filter((e) => e.lifecycleStatus === CredentialLifecycleStatus.NEW).length

    // readinessScore = 所有 Provider 状态权重的平均值
    let scoreSum = 0
    for (const entry of allEntries) {
      scoreSum += STATUS_WEIGHTS[entry.lifecycleStatus] ?? 0
    }
    const readinessScore = total > 0 ? Math.round(scoreSum / total) : 100

    // lastValidation = 最近一次任何验证的时间
    let lastValidation: string | null = null
    for (const entry of allEntries) {
      if (entry.lastValidatedAt) {
        const iso = entry.lastValidatedAt.toISOString()
        if (!lastValidation || iso > lastValidation) {
          lastValidation = iso
        }
      }
    }

    // 提取 unique provider 数量
    const uniqueProviders = new Set(allEntries.map((e) => e.provider))

    return {
      runtimeReady: requiresReconfig === 0 && disabled === 0,
      readinessScore,
      providers: uniqueProviders.size,
      totalCredentials: total,
      healthyCredentials: active,
      healthy: active,
      reconfigurationRequired: requiresReconfig,
      credentialLifecycle: {
        active,
        invalid,
        requiresReconfiguration: requiresReconfig,
        disabled,
      },
      lastValidation,
    }
  }

  /**
   * 同步 Encryption Guard 结果到 Credential Lifecycle
   * 将 decrypt_failed 的密钥标记为 REQUIRES_RECONFIGURATION
   */
  async syncEncryptionGuardResult(): Promise<void> {
    const guardResult = getEncryptionGuardResult()
    if (!guardResult || !guardResult.keyConfigured) return

    for (const detail of guardResult.details) {
      if (detail.status !== 'failed') continue

      const source = detail.source
      let ownerType: string
      let ownerId: string
      let provider: string

      if (source.startsWith('ApiKey:')) {
        const apiKeyProvider = source.replace('ApiKey:', '')
        provider = apiKeyProvider
        ownerType = 'platform'
        ownerId = 'platform'
      } else if (source.startsWith('UserModelConfigV2:')) {
        const userId = source.replace('UserModelConfigV2:', '')
        provider = detail.keyName.toLowerCase() // llm, image, video, tts
        ownerType = 'user'
        ownerId = userId
      } else {
        continue
      }

      try {
        await this.transition(
          ownerType,
          ownerId,
          provider,
          CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
          { reason: 'Encryption key mismatch at startup', code: detail.error },
        )
        console.log(
          `[CredentialLifecycle] 🔄 Synced ${source} → REQUIRES_RECONFIGURATION`,
        )
      } catch (err: any) {
        // 如果已经是 REQUIRES_RECONFIGURATION 或 DISABLED，transition 可能失败，忽略
        if (!err.message.startsWith('Illegal transition')) {
          console.warn(`[CredentialLifecycle] ⚠️ Could not sync ${source}: ${err.message}`)
        }
      }
    }
  }

  /**
   * Recover a credential — re-encrypt API key, transition to VALIDATING,
   * run health check, and transition to ACTIVE (success) or INVALID (failure).
   *
   * This is the ONLY method that should be called by the Recovery UI flow.
   * Never write lifecycleStatus directly.
   *
   * @param provider - Provider name (e.g. 'deepseek')
   * @param apiKey - Plaintext API key to store
   * @param ownerType - Defaults to 'platform'
   * @param ownerId - Defaults to 'platform'
   * @returns The final lifecycle status after health check
   */
  async recoverCredential(
    provider: string,
    apiKey: string,
    ownerType: string = 'platform',
    ownerId: string = 'platform',
  ): Promise<{ status: CredentialLifecycleStatus; summary: RuntimeSummaryResult }> {
    // Step 1: Verify current status allows recovery (REQUIRES_RECONFIGURATION or INVALID)
    const currentStatus = await this.getStatus(ownerType, ownerId, provider)
    if (
      currentStatus !== CredentialLifecycleStatus.REQUIRES_RECONFIGURATION &&
      currentStatus !== CredentialLifecycleStatus.INVALID
    ) {
      throw new Error(
        `Cannot recover credential for ${provider}: current status is ${currentStatus}, ` +
        `expected REQUIRES_RECONFIGURATION or INVALID`,
      )
    }

    // Step 2: Encrypt and update the API key in the database
    const { encryptKey } = await import('../../services/crypto.service.js')
    const encryptedKey = encryptKey(apiKey)

    // Find the ApiKey record (source credential record for platform keys)
    const existingEntry = await this.getEntry(ownerType, ownerId, provider)
    if (existingEntry?.credentialSourceId) {
      await this.prisma.apiKey.update({
        where: { id: existingEntry.credentialSourceId },
        data: {
          keyValue: encryptedKey,
          updatedAt: new Date(),
        },
      })
    } else {
      // If no source record found, upsert into ApiKey table
      await this.prisma.apiKey.upsert({
        where: { provider },
        update: {
          keyValue: encryptedKey,
          updatedAt: new Date(),
        },
        create: {
          provider,
          keyName: `${provider}_api_key`,
          keyValue: encryptedKey,
          keyType: 'platform',
          isActive: true,
        },
      })
    }

    // Step 3: Transition to VALIDATING
    await this.transition(
      ownerType,
      ownerId,
      provider,
      CredentialLifecycleStatus.VALIDATING,
      { reason: 'Credential recovery initiated', code: 'RECOVERY' },
    )

    // Step 4: Run health check — verify the new key directly via callLLM
    // (providerHealthRegistry.checkProvider uses the old resolved key, so we test directly)
    let healthStatus = 'healthy'
    let healthFailureReason: string | null = null

    try {
      const { unifiedAIGateway } = await import('../../services/unified-ai-gateway.js')
      await unifiedAIGateway.callLLM({
        provider,
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'Reply with exactly one word: ok' }],
        apiKey,
        maxTokens: 10,
        temperature: 0.1,
      })
      healthStatus = 'healthy'
    } catch (err: any) {
      healthStatus = 'auth_failed'
      healthFailureReason = err.message
      console.log(`[recoverCredential] callLLM failed for ${provider}: ${err.message}`)
    }

    // Step 5: Transition based on health check result
    if (healthStatus === 'healthy') {
      await this.transition(
        ownerType,
        ownerId,
        provider,
        CredentialLifecycleStatus.ACTIVE,
      )
    } else {
      await this.transition(
        ownerType,
        ownerId,
        provider,
        CredentialLifecycleStatus.INVALID,
        { reason: healthFailureReason || 'Health check failed', code: healthStatus },
      )
    }

    // Return final status + updated summary
    const finalStatus = await this.getStatus(ownerType, ownerId, provider)
    const summary = await this.getSummary()

    return { status: finalStatus, summary }
  }

  // ─── Private ───

  private async getEntry(
    ownerType: string,
    ownerId: string,
    provider: string,
  ): Promise<CredentialLifecycleEntry | null> {
    try {
      const entry = await this.prisma.credentialRuntimeState.findUnique({
        where: { ownerType_ownerId_provider: { ownerType, ownerId, provider } },
      })
      return entry ? this.mapEntry(entry) : null
    } catch {
      return null
    }
  }

  private mapEntry(e: any): CredentialLifecycleEntry {
    return {
      id: e.id,
      provider: e.provider,
      ownerType: e.ownerType,
      ownerId: e.ownerId,
      lifecycleStatus: e.lifecycleStatus,
      credentialSourceType: e.credentialSourceType ?? null,
      credentialSourceId: e.credentialSourceId ?? null,
      lastValidatedAt: e.lastValidatedAt ?? null,
      lastSuccessAt: e.lastSuccessAt ?? null,
      lastFailureAt: e.lastFailureAt ?? null,
      failureReason: e.failureReason ?? null,
      failureCode: e.failureCode ?? null,
      validationCount: e.validationCount ?? 0,
      consecutiveFailures: e.consecutiveFailures ?? 0,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }
  }
}

let _instance: CredentialLifecycleService | null = null

export function initCredentialLifecycleService(prisma: any): CredentialLifecycleService {
  _instance = new CredentialLifecycleService(prisma)
  return _instance
}

export function getCredentialLifecycleService(): CredentialLifecycleService {
  if (!_instance) {
    throw new Error('CredentialLifecycleService 未初始化')
  }
  return _instance
}
