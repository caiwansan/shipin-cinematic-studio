// tests/security/tenant-guard.spec.ts
// FIX 2026-07-23: Tenant Guard 自动化测试 — Day 3 验收

import { describe, it, expect } from 'vitest'
import { resolveTenantId } from '@/middleware/tenant-guard'

describe('Tenant Guard - Day 3 验收', () => {
  
  describe('Rule 1: 禁止客户端传入 tenantId', () => {
    it('POST body.tenantId → 403 TENANT_ID_FROM_JWT_ONLY', () => {
      const req = {
        method: 'POST',
        body: { tenantId: 'evil-tenant' },
        query: {},
        headers: {},
        user: { id: 'user-1', organizationId: 'valid-tenant' }
      } as any

      expect(() => resolveTenantId(req))
        .toThrow('TENANT_ID_FROM_JWT_ONLY')
    })

    it('GET query.tenantId → 403 TENANT_ID_FROM_JWT_ONLY', () => {
      const req = {
        method: 'GET',
        body: {},
        query: { tenantId: 'evil-tenant' },
        headers: {},
        user: { id: 'user-1', organizationId: 'valid-tenant' }
      } as any

      expect(() => resolveTenantId(req))
        .toThrow('TENANT_ID_FROM_JWT_ONLY')
    })

    it('header x-tenant-id → 403 TENANT_ID_FROM_JWT_ONLY', () => {
      const req = {
        method: 'GET',
        body: {},
        query: {},
        headers: { 'x-tenant-id': 'evil-tenant' },
        user: { id: 'user-1', organizationId: 'valid-tenant' }
      } as any

      expect(() => resolveTenantId(req))
        .toThrow('TENANT_ID_FROM_JWT_ONLY')
    })
  })

  describe('Rule 2: tenantId 必须来自 JWT', () => {
    it('JWT.organizationId → 提取成功', () => {
      const req = {
        method: 'GET',
        body: {},
        query: {},
        headers: {},
        user: { id: 'user-1', organizationId: 'org-abc-123' }
      } as any

      expect(resolveTenantId(req)).toBe('org-abc-123')
    })

    it('无 JWT → TENANT_ID_MISSING', () => {
      const req = {
        method: 'GET',
        body: {},
        query: {},
        headers: {},
        user: undefined
      } as any

      expect(() => resolveTenantId(req))
        .toThrow('TENANT_ID_MISSING')
    })
  })
})
