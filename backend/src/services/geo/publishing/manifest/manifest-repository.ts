import { prisma } from '../../../../utils/index';
import type { PublishManifest } from './types';

type ManifestStatus = 'draft' | 'published' | 'archived';

export interface ManifestRecord {
  id: string;
  slug: string;
  type: string;
  name: string;
  status: ManifestStatus;
  version: number;
  manifest: PublishManifest;
  sourceId: string | null;
  sourceType: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

// Prisma JSON parse wrapper
function parseManifest(json: any): PublishManifest {
  return JSON.parse(JSON.stringify(json)) as PublishManifest;
}

export const manifestRepository = {
  async findById(id: string): Promise<ManifestRecord | null> {
    const row = await prisma.publishManifest.findUnique({ where: { id } });
    if (!row) return null;
    return {
      ...row,
      manifest: parseManifest(row.manifest),
      status: row.status as ManifestStatus,
      publishedAt: row.publishedAt ?? null,
      archivedAt: row.archivedAt ?? null,
    };
  },

  async findBySlug(slug: string, status?: string): Promise<ManifestRecord | null> {
    const where: any = { slug };
    if (status) where.status = status;
    const row = await prisma.publishManifest.findFirst({ where });
    if (!row) return null;
    return {
      ...row,
      manifest: parseManifest(row.manifest),
      status: row.status as ManifestStatus,
      publishedAt: row.publishedAt ?? null,
      archivedAt: row.archivedAt ?? null,
    };
  },

  async findAll(filter?: { type?: string; status?: string }): Promise<ManifestRecord[]> {
    const where: any = {};
    if (filter?.type) where.type = filter.type;
    if (filter?.status) where.status = filter.status;
    const rows = await prisma.publishManifest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(r => ({
      ...r,
      manifest: parseManifest(r.manifest),
      status: r.status as ManifestStatus,
      publishedAt: r.publishedAt ?? null,
      archivedAt: r.archivedAt ?? null,
    }));
  },

  async create(data: {
    slug: string;
    type: string;
    name: string;
    manifest: PublishManifest;
    sourceId?: string;
    sourceType?: string;
  }): Promise<ManifestRecord> {
    const row = await prisma.publishManifest.create({
      data: {
        slug: data.slug,
        type: data.type,
        name: data.name,
        status: 'draft',
        version: 1,
        manifest: JSON.parse(JSON.stringify(data.manifest)),
        sourceId: data.sourceId || null,
        sourceType: data.sourceType || null,
      },
    });
    return {
      ...row,
      manifest: parseManifest(row.manifest),
      status: row.status as ManifestStatus,
      publishedAt: row.publishedAt ?? null,
      archivedAt: row.archivedAt ?? null,
    };
  },

  async publish(id: string): Promise<ManifestRecord | null> {
    const now = new Date();
    const existing = await prisma.publishManifest.findUnique({ where: { id } });
    if (!existing) return null;
    const nextVersion = existing.status === 'published' ? existing.version + 1 : existing.version;
    await prisma.publishManifest.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: now,
        version: nextVersion,
      },
    });
    return this.findById(id);
  },

  async archive(id: string): Promise<ManifestRecord | null> {
    await prisma.publishManifest.update({
      where: { id },
      data: { status: 'archived', archivedAt: new Date() },
    });
    return this.findById(id);
  },

  async update(id: string, data: { manifest?: PublishManifest; name?: string }): Promise<ManifestRecord | null> {
    const updateData: any = {};
    if (data.manifest) updateData.manifest = JSON.parse(JSON.stringify(data.manifest));
    if (data.name) updateData.name = data.name;
    if (Object.keys(updateData).length === 0) return this.findById(id);
    await prisma.publishManifest.update({ where: { id }, data: updateData });
    return this.findById(id);
  },

  async getStats() {
    const [total, byType, byStatus] = await Promise.all([
      prisma.publishManifest.count(),
      prisma.publishManifest.groupBy({ by: ['type'], _count: true }),
      prisma.publishManifest.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      total,
      byType: Object.fromEntries(byType.map(r => [r.type, r._count])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
    };
  },
};
