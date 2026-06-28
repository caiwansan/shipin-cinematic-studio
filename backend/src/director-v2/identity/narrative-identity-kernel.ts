/**
 * identity/narrative-identity-kernel.ts — Phase 8 叙事身份内核（主入口）
 *
 * 编排完整 Identity Pipeline：
 *   MemorySnapshot → Identity Drift → Behavior Bias → biasHints → Adaptive Kernel
 *
 * 宪法：
 *   - 身份仅从 Memory 演化（无 LLM）
 *   - 不修改 IR/Timeline/ExecutionPlan
 *   - 仅输出偏置提示
 */

import type { MemoryKernel, MemorySnapshot } from '../memory/memory-kernel.js'
import { IdentityDriftEngine } from './identity-drift-engine.js'
import { BehaviorBiasEngine, type BehaviorBias } from './behavior-bias-engine.js'
import { MemoryToActionMapper, type MemoryActionHint } from './memory-to-action-mapper.js'
import type { IdentityVector } from './identity-vector.js'
import { IdentityVectorUtil } from './identity-vector.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface IdentitySnapshot {
  characters: Record<string, IdentityVector>
  biases: Record<string, BehaviorBias>
  memoryHints: Record<string, MemoryActionHint>
  driftHistory: Array<{
    characterId: string
    trait: keyof IdentityVector
    before: number
    after: number
    magnitude: number
  }>
}

// ─── NarrativeIdentityKernel ─────────────────────────

export class NarrativeIdentityKernel {
  private driftEngine: IdentityDriftEngine
  private biasEngine: BehaviorBiasEngine
  private mapper: MemoryToActionMapper
  private driftHistory: IdentitySnapshot['driftHistory'] = []

  constructor() {
    this.driftEngine = new IdentityDriftEngine()
    this.biasEngine = new BehaviorBiasEngine()
    this.mapper = new MemoryToActionMapper()
  }

  /** 消费记忆快照，更新身份 */
  consume(memory: MemoryKernel, characterIds: string[]): void {
    for (const charId of characterIds) {
      const before = this.driftEngine.getIdentity(charId)
      const beforeClone = IdentityVectorUtil.clone(before)

      this.driftEngine.updateFromMemory(charId, memory.emotion, memory.scenes)

      const after = this.driftEngine.getIdentity(charId)
      const diffs = IdentityVectorUtil.diff(beforeClone, after)
      for (const { trait, delta } of diffs) {
        this.driftHistory.push({
          characterId: charId,
          trait,
          before: beforeClone[trait],
          after: after[trait],
          magnitude: delta,
        })
      }
    }
  }

  /** 获取偏置提示 */
  getBiases(memory: MemoryKernel): Record<string, BehaviorBias> {
    const biases: Record<string, BehaviorBias> = {}
    for (const [charId, vec] of this.driftEngine.getAllIdentities()) {
      biases[charId] = this.biasEngine.computeBias(vec)
    }
    return biases
  }

  /** 获取记忆到动作映射提示 */
  getMemoryHints(memory: MemoryKernel): Record<string, MemoryActionHint> {
    const hints: Record<string, MemoryActionHint> = {}
    for (const [charId, vec] of this.driftEngine.getAllIdentities()) {
      hints[charId] = this.mapper.map(memory.scenes, memory.causal, vec)
    }
    return hints
  }

  /** 获取完整快照 */
  snapshot(memory: MemoryKernel): IdentitySnapshot {
    const characters: Record<string, IdentityVector> = {}
    for (const [id, v] of this.driftEngine.getAllIdentities()) {
      characters[id] = IdentityVectorUtil.clone(v)
    }
    return {
      characters,
      biases: this.getBiases(memory),
      memoryHints: this.getMemoryHints(memory),
      driftHistory: [...this.driftHistory],
    }
  }

  clear(): void {
    this.driftEngine.clear()
    this.driftHistory = []
  }
}

export default NarrativeIdentityKernel
