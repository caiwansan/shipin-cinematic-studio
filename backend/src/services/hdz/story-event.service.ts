/**
 * services/hdz/story-event.service.ts — 剧情事件服务
 *
 * 职责：
 * - 剧情事件的 CRUD
 * - 时间线查询
 * - 角色相关事件查询
 */

import { prisma } from '../../utils/index.js'

export interface StoryEventData {
  projectId: string
  chapterNo: number
  eventType: string
  title: string
  description: string
  participants?: string[]
  impacts?: any[]
  location?: string
}

/**
 * 创建剧情事件
 */
export async function createEvent(data: StoryEventData) {
  return prisma.storyEvent.create({
    data: {
      projectId: data.projectId,
      chapterNo: data.chapterNo,
      eventType: data.eventType,
      title: data.title,
      description: data.description,
      participants: data.participants || [],
      impacts: data.impacts || [],
      location: data.location || null,
    },
  })
}

/**
 * 批量创建剧情事件
 */
export async function createEventsBatch(projectId: string, events: StoryEventData[]) {
  if (events.length === 0) return []
  return prisma.storyEvent.createMany({
    data: events.map(e => ({
      projectId,
      chapterNo: e.chapterNo,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      participants: e.participants || [],
      impacts: e.impacts || [],
      location: e.location || null,
    })),
  })
}

/**
 * 获取章节事件
 */
export async function getEventsByChapter(projectId: string, chapterNo: number) {
  return prisma.storyEvent.findMany({
    where: { projectId, chapterNo },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * 获取角色相关事件
 */
export async function getEventsByCharacter(projectId: string, characterId: string) {
  return prisma.storyEvent.findMany({
    where: { projectId, participants: { has: characterId } },
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * 获取完整时间线
 */
export async function getTimeline(projectId: string) {
  return prisma.storyEvent.findMany({
    where: { projectId },
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * 删除事件
 */
export async function deleteEvent(eventId: string) {
  return prisma.storyEvent.delete({ where: { id: eventId } })
}

/**
 * 获取事件详情
 */
export async function getEventById(eventId: string) {
  return prisma.storyEvent.findUnique({ where: { id: eventId } })
}
