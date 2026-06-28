import { prisma } from '../utils/index.js'

export const projectService = {
  async findAll(userId?: string) {
    const where: any = {}
    if (userId) where.userId = userId
    return await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        userId: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
  },

  async findById(id: string) {
    return await prisma.project.findUnique({ where: { id }, include: { storyboards: true, videoTasks: true } })
  },

  async create(data: any) {
    // 映射 title → name（前端可能传 title 而非 name）
    if (data.title && !data.name) { data.name = data.title }
    delete data.title
    return await prisma.project.create({ data })
  },

  async update(id: string, data: any) {
    // 版本冲突检测：如果传入了 version，校验是否落后于数据库
    if (data.version !== undefined) {
      const existing = await prisma.project.findUnique({
        where: { id },
        select: { version: true }
      })
      if (!existing) {
        throw Object.assign(new Error('项目不存在'), { statusCode: 404 })
      }
      if (data.version < existing.version) {
        throw Object.assign(
          new Error(`版本冲突：当前版本 ${existing.version}，客户端版本 ${data.version}，请刷新后重试`),
          { statusCode: 409 }
        )
      }
      // 校验通过后递增版本，并从 data 中移除旧版本值
      data.version = existing.version + 1
    }

    // 过滤掉 Prisma Project 模型不认识的字段（如 characterSpecs / sceneSpecs 等关联表字段）
    // 这些应该通过专门的 save API 写入，不混在 project.update 里
    const knownFields = new Set([
      'id', 'name', 'description', 'script', 'status', 'version',
      'budgetLimit', 'budgetSpent', 'budgetAlertAt', 'budgetNotified',
      'executionResults', 'runtimeCheckpoint', 'failureEvents', 'executionJournal',
      'plotBlueprint', 'continuationFrom', 'createdAt', 'updatedAt',
    ])
    const cleanData: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (knownFields.has(key)) {
        cleanData[key] = value
      }
    }

    return await prisma.project.update({ where: { id }, data: cleanData })
  },

  async delete(id: string) {
    return await prisma.project.delete({ where: { id } })
  },

  async saveExecutionResults(projectId: string, executionResults: any) {
    return await prisma.project.update({
      where: { id: projectId },
      data: { executionResults },
    })
  },

  async getExecutionResults(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { executionResults: true },
    })
    return project?.executionResults || null
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

