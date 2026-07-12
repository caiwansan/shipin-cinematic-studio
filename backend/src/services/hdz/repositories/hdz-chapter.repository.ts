// ============================================================
// HDZ Chapter Repository — CRUD for HdzChapter
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzChapterDTO {
  id: string
  projectId: string
  chapterNo: number
  title: string | null
  status: string
  outline: string | null
  content: string | null
  wordCount: number | null
  summary: string | null
  reviewNotes: any
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzChapterDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    chapterNo: record.chapterNo,
    title: record.title || null,
    status: record.status,
    outline: record.outline || null,
    content: record.content || null,
    wordCount: record.wordCount ?? null,
    summary: record.summary || null,
    reviewNotes: record.reviewNotes || [],
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const hdzChapterRepository = {
  async findUnique(where: any): Promise<HdzChapterDTO | null> {
    const record = await prisma.hdzChapter.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzChapterDTO | null> {
    const record = await prisma.hdzChapter.findFirst({ where, orderBy })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzChapterDTO[]> {
    // Support both (args) and (where, orderBy) signatures
    if (typeof where === 'object' && where !== null && ('where' in where || 'orderBy' in where || 'skip' in where || 'take' in where)) {
      // Called as findMany({ where, orderBy }) — single args object
      const records = await prisma.hdzChapter.findMany(where)
      return records.map(toDTO)
    }
    const records = await prisma.hdzChapter.findMany({ where, orderBy })
    return records.map(toDTO)
  },

  async create(data: any): Promise<HdzChapterDTO> {
    const record = await prisma.hdzChapter.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<HdzChapterDTO | null> {
    try {
      const record = await prisma.hdzChapter.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async upsert(where: any, create: any, update: any): Promise<HdzChapterDTO> {
    const record = await prisma.hdzChapter.upsert({ where, create, update })
    return toDTO(record)
  },

  async delete(where: any): Promise<void> {
    await prisma.hdzChapter.delete({ where })
  },

  async count(where?: any): Promise<number> {
    return prisma.hdzChapter.count({ where })
  },
}
