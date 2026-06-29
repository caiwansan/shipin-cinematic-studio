/**
 * GEO Project Repository — Real repository using BaseRepository + PrismaAdapter.
 *
 * Maps between Prisma GEOProject records and the platform Project domain model.
 * All GEO project data access goes through this repository.
 *
 * @package @studio/platform/repository
 * @see DATA-SPEC.md §2
 * @see ADR-004
 */

import { BaseRepository } from './base-repository';
import type { ORMAdapter } from './base-repository';

// ============ Domain Types ============

/**
 * GEO-specific project model used internally.
 * Maps to the kmki_geo_projects table via PrismaAdapter.
 */
export interface GEOProjectRecord {
  id: string;
  userId: string;
  name: string;
  topic?: string;
  industry?: string;
  language: string;
  country?: string;
  status: string;
  config: Record<string, unknown>;
  workspaceId?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prisma raw record shape for kmki_geo_projects.
 */
export interface PrismaGEOProject {
  id: string;
  userId: string;
  name: string;
  topic: string | null;
  industry: string | null;
  language: string;
  country: string | null;
  status: string;
  config: any;
  workspaceId: string | null; // mapped from workspace_id via @@map
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform Project model (unified across all workspaces).
 */
export interface PlatformProject {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ============ Repository ============

/**
 * GEO Project Repository.
 *
 * Concrete implementation of BaseRepository for GEO projects.
 * Maps kmki_geo_projects table records to the platform Project domain model.
 *
 * All operations go through: Service → Repository → PrismaAdapter → Prisma → DB
 */
export class GEOProjectRepository extends BaseRepository<PlatformProject, PrismaGEOProject> {
  protected tableName = 'gEOProject'; // Prisma accessor for kmki_geo_projects (lowercase)

  constructor(orm: ORMAdapter) {
    super(orm);
  }

  /**
   * Map Prisma record → Platform Project domain model.
   */
  protected mapPrisma(record: PrismaGEOProject): PlatformProject {
    return {
      id: record.id,
      name: record.name,
      description: record.topic || undefined,
      type: 'geo',
      status: record.status,
      userId: record.userId,
      metadata: {
        topic: record.topic || undefined,
        industry: record.industry || undefined,
        language: record.language,
        country: record.country || undefined,
        workspaceId: record.workspaceId || undefined,
        config: record.config || {},
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString(),
    };
  }

  /**
   * Domain model → Prisma create input.
   */
  protected toCreateInput(data: Partial<PlatformProject>): Partial<PrismaGEOProject> {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    return {
      userId: data.userId || '',
      name: data.name || '',
      topic: (metadata.topic as string) || data.description || null,
      industry: (metadata.industry as string) || null,
      language: (metadata.language as string) || 'zh',
      country: (metadata.country as string) || null,
      status: (data.status as string) || 'draft',
      config: (metadata.config as Record<string, unknown>) || {},
      workspaceId: (metadata.workspaceId as string) || null,
    } as Partial<PrismaGEOProject>;
  }

  /**
   * Domain model → Prisma update input.
   */
  protected toUpdateInput(data: Partial<PlatformProject>): Partial<PrismaGEOProject> {
    const metadata = (data.metadata || {}) as Record<string, unknown>;
    const input: Record<string, unknown> = {};

    if (data.name) input.name = data.name;
    if (data.description) input.topic = data.description;
    if (data.status) input.status = data.status;
    if (metadata.topic) input.topic = metadata.topic;
    if (metadata.industry) input.industry = metadata.industry;
    if (metadata.language) input.language = metadata.language;
    if (metadata.country) input.country = metadata.country;
    if (metadata.config) input.config = metadata.config;
    if (metadata.workspaceId) input.workspaceId = metadata.workspaceId;

    return input as Partial<PrismaGEOProject>;
  }
}
