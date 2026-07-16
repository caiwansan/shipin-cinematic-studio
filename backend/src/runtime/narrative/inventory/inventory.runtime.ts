/**
 * Inventory Runtime — 角色物品清单
 * 
 * Phase 2 新增。
 * SSOT for: 角色拥有的物品及其状态演化。
 * 
 * Queryable:
 * - 主角的戒指还在吗？什么时候丢的？
 * - 那封信被送到谁手里了？
 * - 毒药还在林辰身上吗？
 */

import { randomUUID as uuid } from 'crypto'
import type { InventoryFact, ItemState, ItemType, ItemTransition, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'

const RUNTIME_NAME = 'inventory'

export class InventoryRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json')
    if (existing) return
    narrativeRepository.writeJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json', [])
    console.log(`[InventoryRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<InventoryFact[]> {
    return narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json') || []
  }

  // ─── 管理 ───

  /** 角色获得物品 */
  acquire(projectId: string, item: Omit<InventoryFact, 'id' | 'projectId' | 'active' | 'currentState' | 'transitions'>): InventoryFact {
    const all = narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json') || []
    const transition: ItemTransition = {
      state: 'owned',
      chapterNo: item.trace.chapterNo,
      description: `获得"${item.itemName}"`,
      trace: item.trace,
      timestamp: new Date().toISOString(),
    }
    const fact: InventoryFact = {
      ...item,
      id: uuid(),
      projectId,
      transitions: [transition],
      currentState: 'owned',
      active: true,
    }
    all.push(fact)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'inventory.json', all)
    return fact
  }

  /** 物品状态变化（丢失/损坏/使用/转移） */
  transition(projectId: string, itemName: string, ownerId: string, transition: Omit<ItemTransition, 'timestamp'>): void {
    const all = narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json') || []
    const idx = all.findIndex(i => i.itemName === itemName && i.ownerCharacterId === ownerId && i.active)
    if (idx === -1) return
    const t: ItemTransition = { ...transition, timestamp: new Date().toISOString() }
    all[idx].transitions.push(t)
    all[idx].currentState = transition.state
    if (transition.newOwnerId) {
      all[idx].ownerCharacterId = transition.newOwnerId
      all[idx].ownerCharacterName = transition.newOwnerName || ''
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'inventory.json', all)
  }

  /** 查询角色当前拥有的所有物品 */
  getByOwner(projectId: string, characterId: string): InventoryFact[] {
    const all = narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json') || []
    return all.filter(i => i.ownerCharacterId === characterId && i.currentState === 'owned' && i.active)
  }

  /** 查询单个物品的完整生命周期 */
  getItemLifecycle(projectId: string, itemName: string): InventoryFact[] {
    const all = narrativeRepository.readJson<InventoryFact[]>(projectId, RUNTIME_NAME, 'inventory.json') || []
    return all.filter(i => i.itemName === itemName && i.active)
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'inventory.json')
  }
}
