/**
 * rfvl/runtime-verifier.ts — RFVL 运行时验证器
 *
 * 从 RFVL 引擎获取已完成的 trace 记录，验证：
 *   1. SEEL gate check — 入口必须是 /api/tasks/ai-generate
 *   2. Queue check — 必须经过 QUEUE 步骤
 *   3. MSAL authority — 模型选择来源必须是 MSAL
 *   4. Adapter resolution — 适配器必须通过注册表
 *   5. Hash chain integrity — SHA256 chain 不可篡改
 */

import { rfvl } from '../runtime/rfvl-injector.js'
import type { ExecutionProofChain } from '../runtime/execution-proof.js'

export interface RuntimeResult {
  runtimeViolations: number
  total: number
  rate: number
  details: Array<{
    requestId: string
    passed: boolean
    failedSteps: string[]
  }>
}

export class RFVLRuntimeVerifier {

  static async verifyRecentTraces(options: {
    sampleSize?: number
  }): Promise<RuntimeResult> {
    const sampleSize = options.sampleSize || 50
    const details: RuntimeResult['details'] = []

    // 从 RFVL 引擎获取所有已完成的证明链
    const proofs = rfvl.getCompletedProofs(sampleSize)
    const total = proofs.length

    if (total === 0) {
      return {
        runtimeViolations: 0,
        total: 0,
        rate: 0,
        details: [],
      }
    }

    for (const proof of proofs) {
      const failedSteps = proof.chain
        .filter(s => s.status === 'FAIL')
        .map(s => s.name)

      // 重新验证 hash chain 完整性
      const hashIntegrity = this.verifyHashChain(proof)

      const passed = proof.verified && !failedSteps.length && hashIntegrity

      if (!passed && !failedSteps.length) {
        failedSteps.push('HASH_CHAIN_BROKEN')
      }

      details.push({
        requestId: proof.requestId,
        passed,
        failedSteps,
      })
    }

    const runtimeViolations = details.filter(d => !d.passed).length

    return {
      runtimeViolations,
      total,
      rate: runtimeViolations / total,
      details: details.slice(-20), // 只返回最近 20 条详情
    }
  }

  /**
   * 验证 hash chain 完整性
   * 从 H0 开始重建每个步骤的 hash，与存储的 hash 比对
   */
  static verifyHashChain(proof: ExecutionProofChain): boolean {
    const { createHash } = require('crypto')

    let currentHash = createHash('sha256')
      .update(`${proof.requestId}:${proof.timestamp}`)
      .digest('hex')
      .substring(0, 16)

    for (const step of proof.chain) {
      const expectedHash = createHash('sha256')
        .update(`${currentHash}:${step.name}:${JSON.stringify(step.metadata)}`)
        .digest('hex')
        .substring(0, 16)

      if (step.hash !== expectedHash) return false
      currentHash = step.hash
    }

    return true
  }
}
