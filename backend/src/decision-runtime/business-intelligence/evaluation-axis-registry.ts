/**
 * evaluation-axis-registry.ts — 评估轴注册中心
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.1: Business Intelligence Constrained Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件固化评估轴的注册与检索逻辑。
 *
 * 规则：
 *   1. 每个 domain 只能使用预定义的 axes，禁止动态生成
 *   2. axname 全局唯一，跨域可复用（如 credibility/risk 所有域都有）
 *   3. 新增/修改 axis 只能修改 domain-classifier.ts 的注册表
 *
 * @phase decision-runtime
 */

import { DomainType, domainRegistry } from './domain-classifier.js'

// ============================================================
// 1. 评估轴注册中心
// ============================================================

export const evaluationAxisRegistry = {
  /** 获取某领域的所有轴 */
  getAxes(domain: DomainType): string[] {
    return domainRegistry.getAxisNames(domain)
  },

  /** 获取所有已注册的轴名称（去重） */
  getAllAxisNames(): string[] {
    const allTypes = domainRegistry.getAllTypes()
    const nameSet = new Set<string>()
    for (const type of allTypes) {
      for (const name of domainRegistry.getAxisNames(type)) {
        nameSet.add(name)
      }
    }
    return Array.from(nameSet).sort()
  },

  /** 检查轴是否在某领域的注册表中 */
  isAxisRegistered(axisName: string, domain: DomainType): boolean {
    return domainRegistry.getAxisNames(domain).includes(axisName)
  },

  /** 获取某领域某个轴的权重 */
  getDefaultWeight(domain: DomainType, axisName: string): number {
    const axes = domainRegistry.getAxes(domain)
    const axis = axes.find(a => a.name === axisName)
    return axis?.defaultWeight ?? 0.1
  },

  /** 获取轴的数据来源类型 */
  getDataSource(domain: DomainType, axisName: string): 'search' | 'evidence' | 'computed' {
    const axes = domainRegistry.getAxes(domain)
    const axis = axes.find(a => a.name === axisName)
    return axis?.dataSource ?? 'search'
  },
}
