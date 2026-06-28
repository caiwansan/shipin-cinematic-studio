// ============================================================
// policy/domain-policy.ts
//
// 职责：D3 Production Policy Layer — 按 domain 策略覆盖
//   某些 domain 需要不同于全局默认的策略配置
//   例如：video 成本更高，重试应更保守
//
// 规则：
//   - 只覆盖需要不同的字段
//   - 未覆盖的字段继承 global-policy 的默认值
//   - 新增 domain 时必须在此文件注册
// ============================================================

import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import type { ScoringPolicy, RetryPolicy, EscalationPolicy } from './global-policy.js'

// ─── Domain 覆盖策略 ──────────────────────────────────

export interface DomainPolicyOverride {
  /** 覆盖的 domain */
  domain: QualityDomain
  /** 评分策略覆盖（可选） */
  scoring?: Partial<ScoringPolicy>
  /** 重试策略覆盖（可选） */
  retry?: Partial<RetryPolicy>
  /** 升级策略覆盖（可选） */
  escalation?: Partial<EscalationPolicy>
  /** 是否启用决策引擎（可选） */
  enableDecision?: boolean
  /** 覆盖说明 */
  reason: string
}

// ─── 注册表 ────────────────────────────────────────────

/**
 * 每个 domain 的策略覆盖
 * 只包含与全局默认不同的值
 */
export const DOMAIN_POLICY_OVERRIDES: DomainPolicyOverride[] = [
  {
    domain: 'video',
    scoring: {
      // video 成本高，阈值严格，中等质量也 accept 不做过多重试
      acceptThreshold: 0.45,
    },
    retry: {
      // video 生成贵，少重试
      maxQualityRetries: 1,
      maxInfraRetries: 1,
    },
    reason: 'Video 生成成本高，重试和拒绝应更保守',
  },
  {
    domain: 'character',
    retry: {
      // 角色图质量最关键，多给重试机会
      maxQualityRetries: 3,
      maxInfraRetries: 2,
    },
    enableDecision: true,
    reason: '角色定妆图是整个 Identity Anchor 的基础，质量必须保证',
  },
  {
    domain: 'scene',
    retry: {
      maxQualityRetries: 2,
      maxInfraRetries: 1,
    },
    reason: '场景图成本适中，标准重试策略',
  },
  {
    domain: 'storyboard',
    retry: {
      maxQualityRetries: 2,
      maxInfraRetries: 1,
    },
    reason: '分镜图数量多，每帧质量权重低于角色/场景',
  },
]

/**
 * 获取特定 domain 的策略覆盖
 */
export function getDomainOverride(domain: QualityDomain): DomainPolicyOverride | undefined {
  return DOMAIN_POLICY_OVERRIDES.find(o => o.domain === domain)
}
