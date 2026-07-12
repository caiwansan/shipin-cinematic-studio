// ============================================================
// HDZ Project Repository — CRUD for HdzProject
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzProjectDTO {
  id: string
  userId: string
  title: string
  genre: string | null
  wordTarget: number | null
  chapterWordTarget: number | null
  styleDesc: string | null
  status: string
  locks: any
  authorNickname: string | null
  coverPrompt: string | null
  coverImgUrl: string | null
  masterStyle: string | null
  isPublished: boolean
  publishedAt: string | null
  publishWordCount: number | null
  libraryReaderEnabled: boolean
  libraryReaderCache: any
  libraryReaderSummaries: any
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzProjectDTO {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    genre: record.genre || null,
    wordTarget: record.wordTarget ?? null,
    chapterWordTarget: record.chapterWordTarget ?? null,
    styleDesc: record.styleDesc || null,
    status: record.status,
    locks: record.locks || {},
    authorNickname: record.authorNickname || null,
    coverPrompt: record.coverPrompt || null,
    coverImgUrl: record.coverImgUrl || null,
    masterStyle: record.masterStyle || null,
    isPublished: record.isPublished ?? false,
    publishedAt: record.publishedAt?.toISOString() || null,
    publishWordCount: record.publishWordCount ?? null,
    libraryReaderEnabled: record.libraryReaderEnabled ?? false,
    libraryReaderCache: record.libraryReaderCache || {},
    libraryReaderSummaries: record.libraryReaderSummaries || {},
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const hdzProjectRepository = {
  async findUnique(where: any): Promise<HdzProjectDTO | null> {
    const record = await prisma.hdzProject.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzProjectDTO | null> {
    // Compat: support both { where, orderBy } and single-arg { where, orderBy, ... }
    const args = (typeof where === 'object' && where !== null && ('where' in where || 'orderBy' in where)) ? where : { where, orderBy }
    const record = await prisma.hdzProject.findFirst(args)
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzProjectDTO[]> {
    const args = (where && typeof where === 'object' && ('where' in where || 'orderBy' in where || 'skip' in where || 'take' in where || 'select' in where || 'include' in where)) ? where : { where, orderBy }
    const records = await prisma.hdzProject.findMany(args)
    return records.map(toDTO)
  },

  async findUniqueRaw(where: any, options?: { select?: any }): Promise<any | null> {
    const record = await prisma.hdzProject.findUnique({ where, ...options })
    return record
  },

  async create(data: any): Promise<HdzProjectDTO> {
    const record = await prisma.hdzProject.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<HdzProjectDTO | null> {
    try {
      const record = await prisma.hdzProject.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async delete(where: any): Promise<void> {
    await prisma.hdzProject.delete({ where })
  },

  async count(where?: any): Promise<number> {
    return prisma.hdzProject.count({ where })
  },
}
