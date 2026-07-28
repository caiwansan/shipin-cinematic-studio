/**
 * services/hdz/character-state.service.ts — 角色状态服务（增强版）
 *
 * 职责：
 * - 角色状态时间线管理
 * - 当前状态查询（合并版）
 * - 状态变更记录
 * - 自动解决到期状态
 */

import { prisma } from '../../utils/index.js'

export interface StateChangeData {
  projectId: string
  characterId: string
  chapterNo: number
  stateType: string
  event: string
  description?: string
  severity?: string
  recoveryChapter?: number
}

/**
 * 获取角色状态时间线
 */
export async function getStateTimeline(projectId: string, characterId: string) {
  return prisma.hdzCharacterState.findMany({
    where: { projectId, characterId },
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * 获取角色当前状态（最新）
 */
export async function getCurrentState(projectId: string, characterId: string) {
  const states = await prisma.hdzCharacterState.findMany({
    where: { projectId, characterId },
    orderBy: [{ chapterNo: 'desc' }, { createdAt: 'desc' }],
  })

  const STATE_TYPES = ['HEALTH', 'INJURY', 'RELATIONSHIP', 'POWER', 'LOCATION', 'ITEM', 'MENTAL', 'IDENTITY']
  const byType: Record<string, any[]> = {}
  for (const t of STATE_TYPES) byType[t] = []

  for (const s of states) {
    const t = s.stateType.toUpperCase()
    if (!byType[t]) byType[t] = []
    byType[t].push({
      id: s.id,
      chapterNo: s.chapterNo,
      event: s.event,
      description: s.description,
      severity: s.severity,
      recoveryChapter: s.recoveryChapter,
    })
  }

  return byType
}

/**
 * 添加状态变更
 */
export async function addStateChange(data: StateChangeData) {
  return prisma.hdzCharacterState.create({
    data: {
      projectId: data.projectId,
      characterId: data.characterId,
      chapterNo: data.chapterNo,
      stateType: data.stateType.toUpperCase(),
      event: data.event,
      description: data.description,
      severity: data.severity || 'normal',
      recoveryChapter: data.recoveryChapter,
    },
  })
}

/**
 * 获取所有角色当前档案（合并版）
 */
export async function getCharacterProfiles(projectId: string) {
  const characters = await prisma.hdzCharacter.findMany({ where: { projectId } })
  const states = await prisma.hdzCharacterState.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'asc' },
  })

  const STATE_TYPES = ['HEALTH', 'INJURY', 'RELATIONSHIP', 'POWER', 'LOCATION', 'ITEM', 'MENTAL', 'IDENTITY']

  return characters.map(char => {
    const charStates = states.filter(s => s.characterId === char.id)
    const props = (char.properties as any) || {}

    const byType: Record<string, any[]> = {}
    for (const t of STATE_TYPES) byType[t] = []

    for (const s of charStates) {
      const t = s.stateType.toUpperCase()
      if (!byType[t]) byType[t] = []
      byType[t].push({
        id: s.id,
        chapterNo: s.chapterNo,
        event: s.event,
        description: s.description,
        severity: s.severity,
        recoveryChapter: s.recoveryChapter,
      })
    }

    return {
      id: char.id,
      name: char.name,
      role: char.role,
      properties: props,
      arc: char.arc,
      relations: char.relations,
      currentState: {
        HEALTH: byType.HEALTH,
        INJURY: byType.INJURY,
        RELATIONSHIP: byType.RELATIONSHIP,
        POWER: byType.POWER,
        LOCATION: byType.LOCATION,
        ITEM: byType.ITEM,
        MENTAL: byType.MENTAL,
        IDENTITY: byType.IDENTITY,
      },
      totalChanges: charStates.length,
    }
  })
}

/**
 * 自动解决到期的状态（如伤势恢复）
 */
export async function autoResolveStates(projectId: string, chapterNo: number): Promise<number> {
  // 查找所有 recoveryChapter <= 当前 chapterNo 的 INJURY 状态
  const pendingInjuries = await prisma.hdzCharacterState.findMany({
    where: {
      projectId,
      stateType: 'INJURY',
      recoveryChapter: { lte: chapterNo },
    },
  })

  let resolvedCount = 0
  for (const injury of pendingInjuries) {
    // 检查是否已解决
    const existingResolution = await prisma.hdzCharacterState.findFirst({
      where: {
        projectId,
        characterId: injury.characterId,
        stateType: 'RECOVERY',
        chapterNo: { gte: injury.chapterNo },
      },
    })

    if (!existingResolution) {
      await prisma.hdzCharacterState.create({
        data: {
          projectId,
          characterId: injury.characterId,
          chapterNo,
          stateType: 'RECOVERY',
          event: `恢复: ${injury.event}`,
          description: `伤势「${injury.description || injury.event}」已恢复`,
          severity: 'normal',
        },
      })
      resolvedCount++
    }
  }

  return resolvedCount
}

/**
 * 删除状态记录
 */
export async function deleteState(stateId: string) {
  return prisma.hdzCharacterState.delete({ where: { id: stateId } })
}

/**
 * 获取全部角色状态时间线（所有角色）
 */
export async function getAllStates(projectId: string) {
  return prisma.hdzCharacterState.findMany({
    where: { projectId },
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  })
}
