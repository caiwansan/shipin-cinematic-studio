/**
 * Narrative Repository — NOS 统一持久化层
 * 
 * 所有 Runtime 通过此 Repository 读写持久化数据。
 * 当前阶段：JSON 文件存储（领域隔离，可独立回滚）
 * 后续可迁移至 Prisma/Database
 */

import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../../utils/index.js'

const RUNTIME_DATA_DIR = path.resolve(process.cwd(), 'data/runtime/narrative')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function runtimeDir(projectId: string, runtime: string): string {
  const dir = path.join(RUNTIME_DATA_DIR, projectId, runtime)
  ensureDir(dir)
  return dir
}

function dataFile(projectId: string, runtime: string, fileName: string): string {
  return path.join(runtimeDir(projectId, runtime), fileName)
}

export const narrativeRepository = {
  // ─── JSON 文件读写 ───

  readJson<T>(projectId: string, runtime: string, fileName: string): T | null {
    const file = dataFile(projectId, runtime, fileName)
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
      }
    } catch (e) {
      console.error(`[NarrativeRepo] read failed: ${file}`, e)
    }
    return null
  },

  writeJson<T>(projectId: string, runtime: string, fileName: string, data: T): void {
    const file = dataFile(projectId, runtime, fileName)
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.error(`[NarrativeRepo] write failed: ${file}`, e)
      throw e
    }
  },

  deleteJson(projectId: string, runtime: string, fileName: string): void {
    const file = dataFile(projectId, runtime, fileName)
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch (e) {
      console.error(`[NarrativeRepo] delete failed: ${file}`, e)
    }
  },

  listJsonFiles(projectId: string, runtime: string): string[] {
    const dir = runtimeDir(projectId, runtime)
    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    } catch {
      return []
    }
  },

  // ─── 从 Prisma 读取现有数据（用于 Runtime 初始化） ───

  async getCharacters(projectId: string): Promise<any[]> {
    return prisma.hdzCharacter.findMany({ where: { projectId } })
  },

  async getChapters(projectId: string): Promise<any[]> {
    return prisma.hdzChapter.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
    })
  },

  async getMemories(projectId: string): Promise<any[]> {
    return prisma.hdzMemory.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    })
  },

  async getProject(projectId: string): Promise<any | null> {
    return prisma.hdzProject.findUnique({ where: { id: projectId } })
  },

  // ─── 项目生命周期 ───

  deleteProjectData(projectId: string): void {
    const dir = path.join(RUNTIME_DATA_DIR, projectId)
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    } catch (e) {
      console.error(`[NarrativeRepo] deleteProjectData failed: ${projectId}`, e)
    }
  },
}
