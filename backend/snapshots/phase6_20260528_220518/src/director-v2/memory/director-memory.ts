/**
import { normalizeScene, normalizeExecutionPlan, normalizeProjection } from '''../../contracts/bridge/director-v2.bridge.js''';
 * director-memory.ts — Director Memory（可变状态存储）
 *
 * 存储 Continuity Engine 和其他 agent 的可变运行时状态。
 * 与 Constitution（不可变）严格分离。
 *
 * 存储内容：
 *   continuityState: Continuity Engine 的运行时状态
 *   emotionalHistory: 已处理场景的情感轨迹
 *   visualAnchors: 视觉锚点（已确定的视觉决策）
 *   characterLocks: 角色视觉锁定状态
 */

import { prisma } from '../../utils/index.js'

// ============================================================
// Memory Types
// ============================================================

export interface DirectorMemoryState {
  /** Continuity Engine 的运行时状态 */
  continuityState: ContinuityState

  /** 情感历史（按处理顺序排列的场景情感状态） */
  emotionalHistory: EmotionalHistoryEntry[]

  /** 视觉锚点（已确认的视觉决策） */
  visualAnchors: VisualAnchor[]

  /** 角色锁定状态 */
  characterLocks: CharacterLock[]
}

export interface ContinuityState {
  lastShotType: string | null
  lastCameraMotion: string | null
  activeSceneId: string | null
  activeCharacters: string[]
  warnings: string[]
}

export interface EmotionalHistoryEntry {
  sceneId: string
  sceneName: string
  emotion: string
  intensity: number
  processedAt: number
}

export interface VisualAnchor {
  sceneId: string
  anchorType: 'color' | 'lighting' | 'composition' | 'camera'
  value: string
  locked: boolean
}

export interface CharacterLock {
  characterId: string
  characterName: string
  lastCostumeId: string | null
  lastExpression: string | null
  visualKeywords: string[]
  lockVersion: number
}

// ============================================================
// Director Memory Store
// ============================================================

export class DirectorMemoryStore {
  /**
   * 获取或初始化 project 的 memory
   */
  async getOrInit(projectId: string): Promise<DirectorMemoryState> {
    const existing = await prisma.directorMemory.findUnique({
      where: { projectId },
    })

    if (existing) {
      return existing as unknown as DirectorMemoryState
    }

    // 初始化空的 memory
    const init: DirectorMemoryState = {
      continuityState: {
        lastShotType: null,
        lastCameraMotion: null,
        activeSceneId: null,
        activeCharacters: [],
        warnings: [],
      },
      emotionalHistory: [],
      visualAnchors: [],
      characterLocks: [],
    }

    await prisma.directorMemory.create({
      data: {
        projectId,
        continuityState: init.continuityState as unknown as Record<string, unknown>,
        emotionalHistory: init.emotionalHistory as unknown as Record<string, unknown>[],
        visualAnchors: init.visualAnchors as unknown as Record<string, unknown>[],
        characterLocks: init.characterLocks as unknown as Record<string, unknown>[],
      },
    })

    return init
  }

  /**
   * 更新 Continuity State
   */
  async updateContinuityState(
    projectId: string,
    continuityState: ContinuityState,
  ): Promise<void> {
    await prisma.directorMemory.update({
      where: { projectId },
      data: {
        continuityState: continuityState as unknown as Record<string, unknown>,
      },
    })
  }

  /**
   * 追加情感历史记录
   */
  async appendEmotionalHistory(
    projectId: string,
    entry: EmotionalHistoryEntry,
  ): Promise<void> {
    const memory = await this.getOrInit(projectId)
    memory.emotionalHistory.push(entry)

    await prisma.directorMemory.update({
      where: { projectId },
      data: {
        emotionalHistory: memory.emotionalHistory as unknown as Record<string, unknown>[],
      },
    })
  }

  /**
   * 添加视觉锚点
   */
  async addVisualAnchor(
    projectId: string,
    anchor: VisualAnchor,
  ): Promise<void> {
    const memory = await this.getOrInit(projectId)
    memory.visualAnchors.push(anchor)

    await prisma.directorMemory.update({
      where: { projectId },
      data: {
        visualAnchors: memory.visualAnchors as unknown as Record<string, unknown>[],
      },
    })
  }

  /**
   * 更新角色锁定
   */
  async upsertCharacterLock(
    projectId: string,
    lock: CharacterLock,
  ): Promise<void> {
    const memory = await this.getOrInit(projectId)
    const idx = memory.characterLocks.findIndex(
      c => c.characterId === lock.characterId,
    )

    if (idx >= 0) {
      memory.characterLocks[idx] = {
        ...lock,
        lockVersion: memory.characterLocks[idx].lockVersion + 1,
      }
    } else {
      memory.characterLocks.push({ ...lock, lockVersion: 1 })
    }

    await prisma.directorMemory.update({
      where: { projectId },
      data: {
        characterLocks: memory.characterLocks as unknown as Record<string, unknown>[],
      },
    })
  }

  /**
   * 获取最新的 emotionalHistory
   */
  async getEmotionalHistory(projectId: string): Promise<EmotionalHistoryEntry[]> {
    const memory = await this.getOrInit(projectId)
    return memory.emotionalHistory
  }

  /**
   * 获取所有 characterLocks
   */
  async getCharacterLocks(projectId: string): Promise<CharacterLock[]> {
    const memory = await this.getOrInit(projectId)
    return memory.characterLocks
  }

  /**
   * 删除 project 的 memory（重置）
   */
  async delete(projectId: string): Promise<void> {
    await prisma.directorMemory.delete({ where: { projectId } }).catch(() => {})
  }
}

/** 全局单例 */
export const directorMemoryStore = new DirectorMemoryStore()
