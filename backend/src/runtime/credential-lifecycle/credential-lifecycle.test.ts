// ============================================================
// Credential Lifecycle Service — Unit Tests
// ============================================================
// Tests all valid and invalid state transitions.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CredentialLifecycleService,
  CredentialLifecycleStatus,
} from './credential-lifecycle.service.js'

// 内存 Mock Prisma，用于模拟 credentialRuntimeState 行为
function createMockPrisma() {
  const store = new Map<string, any>()

  const makeKey = (ownerType: string, ownerId: string, provider: string) =>
    `${ownerType}:${ownerId}:${provider}`

  return {
    credentialRuntimeState: {
      findUnique: async ({ where }: { where: any }) => {
        if (where.ownerType_ownerId_provider) {
          const { ownerType, ownerId, provider } = where.ownerType_ownerId_provider
          return store.get(makeKey(ownerType, ownerId, provider)) || null
        }
        return null
      },
      findMany: async ({ where }: { where?: any } = {}) => {
        if (where?.ownerType && where?.ownerId) {
          const results: any[] = []
          for (const [key, val] of store.entries()) {
            const [ot, oid] = key.split(':')
            if (ot === where.ownerType && oid === where.ownerId) {
              results.push(val)
            }
          }
          return results
        }
        // Everything
        return Array.from(store.values())
      },
      upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
        let key: string
        if (where.ownerType_ownerId_provider) {
          const { ownerType, ownerId, provider } = where.ownerType_ownerId_provider
          key = makeKey(ownerType, ownerId, provider)
        } else {
          return null
        }

        const existing = store.get(key)
        if (existing) {
          const merged = { ...existing, ...update, updatedAt: new Date() }
          store.set(key, merged)
          return merged
        }

        const now = new Date()
        const entry = {
          id: `mock-${key}`,
          ...create,
          createdAt: now,
          updatedAt: now,
        }
        store.set(key, entry)
        return entry
      },
      create: async ({ data }: { data: any }) => {
        const key = makeKey(data.ownerType, data.ownerId, data.provider)
        const now = new Date()
        const entry = { id: `mock-${key}`, ...data, createdAt: now, updatedAt: now }
        store.set(key, entry)
        return entry
      },
    },
    // 清除 store 的方法（测试用）
    _clear() {
      store.clear()
    },
  }
}

describe('CredentialLifecycleService', () => {
  const mockPrisma = createMockPrisma()
  const service = new CredentialLifecycleService(mockPrisma)

  const OWNER_TYPE = 'user'
  const OWNER_ID = 'test-user-1'
  const PROVIDER = 'deepseek'

  // 每个测试前清除 mock 数据
  beforeEach(() => {
    mockPrisma._clear()
  })

  // ─── 合法转换测试 ───

  describe('valid transitions', () => {
    it('NEW → VALIDATING 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.VALIDATING)
    })

    it('NEW → DISABLED 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.DISABLED)
    })

    it('VALIDATING → ACTIVE 应该成功', async () => {
      // 先到 VALIDATING
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      // 再到 ACTIVE
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.ACTIVE)
    })

    it('VALIDATING → INVALID 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID, {
        reason: 'Authentication failed',
        code: 'AUTH_FAILED',
      })
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.INVALID)
    })

    it('VALIDATING → REQUIRES_RECONFIGURATION 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(
        OWNER_TYPE, OWNER_ID, PROVIDER,
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
        { reason: 'Encryption mismatch', code: 'DECRYPT_FAILED' },
      )
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.REQUIRES_RECONFIGURATION)
    })

    it('ACTIVE → INVALID 应该成功（Provider 认证失败）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID, {
        reason: 'Provider returned 401',
        code: 'AUTH_FAILED',
      })
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.INVALID)
    })

    it('ACTIVE → REQUIRES_RECONFIGURATION 应该成功（加密不匹配）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await service.transition(
        OWNER_TYPE, OWNER_ID, PROVIDER,
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
        { reason: 'Key rotation detected', code: 'CRYPTO_MISMATCH' },
      )
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.REQUIRES_RECONFIGURATION)
    })

    it('ACTIVE → DISABLED 应该成功（管理员操作）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED, {
        reason: 'Admin disabled key',
      })
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.DISABLED)
    })

    it('INVALID → VALIDATING 应该成功（重新验证）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING, {
        reason: 'Retrying validation',
      })
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.VALIDATING)
    })

    it('INVALID → REQUIRES_RECONFIGURATION 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID)
      await service.transition(
        OWNER_TYPE, OWNER_ID, PROVIDER,
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
      )
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.REQUIRES_RECONFIGURATION)
    })

    it('INVALID → DISABLED 应该成功', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.DISABLED)
    })

    it('REQUIRES_RECONFIGURATION → VALIDATING 应该成功（重新配置后验证）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(
        OWNER_TYPE, OWNER_ID, PROVIDER,
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
      )
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.VALIDATING)
    })

    it('REQUIRES_RECONFIGURATION → NEW 应该成功（重新创建凭据）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(
        OWNER_TYPE, OWNER_ID, PROVIDER,
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
      )
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.NEW)
      const status = await service.getStatus(OWNER_TYPE, OWNER_ID, PROVIDER)
      expect(status).toBe(CredentialLifecycleStatus.NEW)
    })
  })

  // ─── 非法转换测试 ───

  describe('invalid transitions should throw', () => {
    it('NEW → ACTIVE 不允许（必须经过 VALIDATING）', async () => {
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('NEW → INVALID 不允许', async () => {
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('NEW → REQUIRES_RECONFIGURATION 不允许', async () => {
      await expect(
        service.transition(
          OWNER_TYPE, OWNER_ID, PROVIDER,
          CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
        ),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('VALIDATING → DISABLED 不允许', async () => {
      // 先到 VALIDATING
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('VALIDATING → NEW 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.NEW),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('ACTIVE → NEW 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.NEW),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('ACTIVE → VALIDATING 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('DISABLED → ACTIVE 不允许（必须经过 VALIDATING）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('DISABLED → VALIDATING 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('DISABLED → INVALID 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('DISABLED → REQUIRES_RECONFIGURATION 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.DISABLED)
      await expect(
        service.transition(
          OWNER_TYPE, OWNER_ID, PROVIDER,
          CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
        ),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('INVALID → ACTIVE 不允许（必须经过 VALIDATING）', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE),
      ).rejects.toThrow(/Illegal transition/)
    })

    it('INVALID → NEW 不允许', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID)
      await expect(
        service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.NEW),
      ).rejects.toThrow(/Illegal transition/)
    })
  })

  // ─── getSummary 测试 ───

  describe('getSummary', () => {
    it('无数据时应该返回默认值', async () => {
      const summary = await service.getSummary()
      expect(summary.runtimeReady).toBe(true)
      expect(summary.readinessScore).toBe(100)
      expect(summary.providers).toBe(0)
      expect(summary.credentialLifecycle.active).toBe(0)
    })

    it('混合状态时应该返回正确统计', async () => {
      // 创建几个不同状态的记录
      await service.transition('user', 'u1', 'deepseek', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'u1', 'deepseek', CredentialLifecycleStatus.ACTIVE)

      await service.transition('user', 'u2', 'volcengine', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'u2', 'volcengine', CredentialLifecycleStatus.INVALID, {
        reason: 'Auth failed',
      })

      await service.transition('user', 'u3', 'siliconflow', CredentialLifecycleStatus.VALIDATING)
      await service.transition(
        'user', 'u3', 'siliconflow',
        CredentialLifecycleStatus.REQUIRES_RECONFIGURATION,
        { reason: 'Decrypt failed', code: 'DECRYPT_FAILED' },
      )

      await service.transition('user', 'u4', 'openai', CredentialLifecycleStatus.DISABLED)

      // platform-level — must go through VALIDATING first
      await service.transition('platform', 'platform', 'aliyun', CredentialLifecycleStatus.VALIDATING)
      await service.transition('platform', 'platform', 'aliyun', CredentialLifecycleStatus.ACTIVE)

      const summary = await service.getSummary()
      // 5 unique providers: deepseek, volcengine, siliconflow, openai, aliyun
      expect(summary.providers).toBe(5)
      expect(summary.credentialLifecycle.active).toBe(2)
      expect(summary.credentialLifecycle.invalid).toBe(1)
      expect(summary.credentialLifecycle.requiresReconfiguration).toBe(1)
      expect(summary.credentialLifecycle.disabled).toBe(1)
      expect(summary.runtimeReady).toBe(false) // requiresReconfig + disabled
    })

    it('readinessScore 应该正确计算', async () => {
      // ACTIVE = 100
      await service.transition('user', 'u1', 'p1', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'u1', 'p1', CredentialLifecycleStatus.ACTIVE)

      // VALIDATING = 50
      await service.transition('user', 'u2', 'p2', CredentialLifecycleStatus.VALIDATING)

      // DISABLED = 0
      await service.transition('user', 'u3', 'p3', CredentialLifecycleStatus.DISABLED)

      const summary = await service.getSummary()
      // Score: (100 + 50 + 0) / 3 = 50
      expect(summary.readinessScore).toBe(50)
    })
  })

  // ─── getAllForOwner 测试 ───

  describe('getAllForOwner', () => {
    it('应该返回指定用户的所有凭证状态', async () => {
      await service.transition('user', 'testuser', 'deepseek', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'testuser', 'deepseek', CredentialLifecycleStatus.ACTIVE)
      await service.transition('user', 'testuser', 'volcengine', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'otheruser', 'siliconflow', CredentialLifecycleStatus.VALIDATING)
      await service.transition('user', 'otheruser', 'siliconflow', CredentialLifecycleStatus.ACTIVE)

      const entries = await service.getAllForOwner('user', 'testuser')
      expect(entries.length).toBe(2)
      expect(entries.map((e) => e.provider).sort()).toEqual(['deepseek', 'volcengine'])
    })
  })

  // ─── transition metadata 测试 ───

  describe('transition metadata tracking', () => {
    it('失败转换应该记录 failure reason 和 code', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.REQUIRES_RECONFIGURATION, {
        reason: 'Test reason',
        code: 'TEST_CODE',
      })

      // 用 getAllForOwner 查出来
      const entries = await service.getAllForOwner(OWNER_TYPE, OWNER_ID)
      const entry = entries.find((e) => e.provider === PROVIDER)
      expect(entry).toBeDefined()
      expect(entry!.failureReason).toBe('Test reason')
      expect(entry!.failureCode).toBe('TEST_CODE')
    })

    it('ACTIVE 转换应该记录 lastSuccessAt', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.ACTIVE)

      const entries = await service.getAllForOwner(OWNER_TYPE, OWNER_ID)
      const entry = entries.find((e) => e.provider === PROVIDER)
      expect(entry!.lastSuccessAt).toBeTruthy()
      expect(entry!.lastValidatedAt).toBeTruthy()
    })

    it('INVALID 转换应该记录 lastFailureAt', async () => {
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.VALIDATING)
      await service.transition(OWNER_TYPE, OWNER_ID, PROVIDER, CredentialLifecycleStatus.INVALID, {
        reason: 'Auth failed',
      })

      const entries = await service.getAllForOwner(OWNER_TYPE, OWNER_ID)
      const entry = entries.find((e) => e.provider === PROVIDER)
      expect(entry!.lastFailureAt).toBeTruthy()
      expect(entry!.failureReason).toBe('Auth failed')
    })
  })
})
