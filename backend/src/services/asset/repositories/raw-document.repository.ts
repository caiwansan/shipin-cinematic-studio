// ============================================================
// Raw Document Repository — save/retrieve raw scan documents
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { RawDocumentData } from '../types.js'

export const rawDocumentRepository = {
  async create(data: RawDocumentData) {
    return prisma.rawDocument.create({
      data: {
        projectId: data.projectId,
        url: data.url,
        mime: data.mime || null,
        headers: data.headers ? JSON.stringify(data.headers) : null,
        html: data.html || null,
        markdown: data.markdown || null,
        text: data.text || null,
        status: data.status || 0,
        fetchedAt: data.fetchedAt || new Date(),
      },
    })
  },

  async findByProject(projectId: string) {
    return prisma.rawDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string) {
    return prisma.rawDocument.findUnique({ where: { id } })
  },
}
