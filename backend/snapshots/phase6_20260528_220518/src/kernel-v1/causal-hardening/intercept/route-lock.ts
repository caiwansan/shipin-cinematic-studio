// causal-hardening/intercept/route-lock.ts — 路由防绕过

import { KernelViolation } from './pre-apply-gate'

export class RouteLock {
  static allowedRoutes = new Set([
    'EntityGraph',
    'Timeline',
    'Snapshot',
    'CreativeDNA',
  ])

  static validate(target: string) {
    if (!this.allowedRoutes.has(target)) {
      throw new KernelViolation(`ROUTE_LOCKED: ${target}`)
    }
  }
}
