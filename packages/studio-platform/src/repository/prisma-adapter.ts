/**
 * PrismaAdapter — Real ORM adapter implementation wrapping PrismaClient.
 *
 * Implements the ORMAdapter interface to provide database operations
 * through Prisma. All GEO repositories and platform services use this
 * adapter to access the database, never PrismaClient directly.
 *
 * @package @studio/platform/repository
 * @see DATA-SPEC.md §2 (Repository → ORM Adapter pattern)
 * @see ADR-004
 */

import type { ORMAdapter } from './base-repository';

/**
 * Default Prisma client type — can be any PrismaClient-like object
 * with model accessors.
 */
export interface PrismaClientLike {
  [model: string]: {
    findMany?: (args?: unknown) => Promise<unknown[]>;
    findUnique?: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    findFirst?: (args?: unknown) => Promise<unknown>;
    create?: (args: { data: unknown }) => Promise<unknown>;
    update?: (args: { where: Record<string, unknown>; data: unknown }) => Promise<unknown>;
    delete?: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    count?: (args?: unknown) => Promise<number>;
    upsert?: (args: unknown) => Promise<unknown>;
    [key: string]: unknown;
  };
}

/**
 * Default table name to Prisma model name mapping strategy.
 *
 * Table names follow platform convention: lowercase with underscores.
 * Prisma models are PascalCase versions of the table name.
 *
 * Examples:
 *   'kmki_geo_projects' -> model name is derived from @@map
 *   'projects'          -> model name 'projects' (or 'project')
 *
 * For best results, the adapter uses the table name directly as the
 * Prisma model accessor key. For @@map'd models, the table name
 * IS the accessor (Prisma creates accessors matching @@map).
 */
export function tableToModelName(tableName: string): string {
  // Prisma client accessors use the @@map value or the model name lowercased
  // We pass the tableName directly since PrismaClient uses @@map as accessor
  return tableName;
}

/**
 * PrismaAdapter — Wraps a PrismaClient instance behind the ORMAdapter interface.
 *
 * Usage:
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * const prisma = new PrismaClient();
 * const adapter = new PrismaAdapter(prisma);
 * const repository = new GEOProjectRepository(adapter);
 * ```
 */
export class PrismaAdapter implements ORMAdapter {
  private prisma: PrismaClientLike;

  constructor(prisma: PrismaClientLike) {
    this.prisma = prisma;
  }

  /**
   * Get the Prisma model accessor for a given table name.
   * PrismaClient accessors are lowercase versions of model names
   * or match the @@map value exactly.
   */
  private model(tableName: string): any {
    const model = this.prisma[tableName];
    if (!model) {
      throw new Error(`[PrismaAdapter] No Prisma model found for table: ${tableName}`);
    }
    return model;
  }

  /**
   * Create a single record.
   */
  async create<T>(tableName: string, data: unknown): Promise<T> {
    const record = await this.model(tableName).create({ data });
    return record as T;
  }

  /**
   * Create multiple records in batch.
   */
  async createMany<T>(tableName: string, data: unknown[]): Promise<number> {
    const result = await this.model(tableName).createMany({ data });
    return result.count ?? data.length;
  }

  /**
   * Find a record by ID (excludes soft-deleted by convention).
   */
  async findById<T>(tableName: string, id: string): Promise<T | null> {
    const record = await this.model(tableName).findUnique({
      where: { id },
    });
    if (!record) return null;

    // Exclude soft-deleted records (has deletedAt field that's non-null)
    if ((record as Record<string, unknown>).deletedAt !== undefined &&
        (record as Record<string, unknown>).deletedAt !== null) {
      return null;
    }

    return record as T;
  }

  /**
   * Find records matching conditions.
   */
  async findMany<T>(
    tableName: string,
    where?: Record<string, unknown>,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }
  ): Promise<T[]> {
    const args: Record<string, unknown> = {};

    // Build where clause, excluding soft-deleted by default
    if (where && Object.keys(where).length > 0) {
      args.where = { ...where };
      // If the caller didn't explicitly handle deletedAt, auto-exclude
      if (!('deletedAt' in args.where)) {
        args.where = { ...args.where as Record<string, unknown>, deletedAt: null };
      }
    } else {
      // Default: exclude soft-deleted
      args.where = { deletedAt: null };
    }

    if (options?.skip) args.skip = options.skip;
    if (options?.take) args.take = options.take;
    if (options?.orderBy) args.orderBy = options.orderBy;

    const records = await this.model(tableName).findMany(args);
    return records as T[];
  }

  /**
   * Update a record by ID.
   */
  async update<T>(tableName: string, id: string, data: unknown): Promise<T> {
    const record = await this.model(tableName).update({
      where: { id },
      data,
    });
    return record as T;
  }

  /**
   * Soft-delete a record by ID (sets deletedAt timestamp).
   */
  async softDelete(tableName: string, id: string): Promise<void> {
    await this.model(tableName).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Update with optimistic locking.
   */
  async updateWithVersion<T>(
    tableName: string,
    id: string,
    version: number,
    data: unknown
  ): Promise<T> {
    // First check current version
    const existing = await this.findById<Record<string, unknown>>(tableName, id);
    if (!existing) {
      throw new Error(`[PrismaAdapter] Record not found for updateWithVersion: ${id}`);
    }

    const currentVersion = existing.version as number;
    if (currentVersion !== version) {
      throw new Error(
        `[PrismaAdapter] Version conflict for ${id}: expected ${version}, got ${currentVersion}`
      );
    }

    return this.update<T>(tableName, id, {
      ...(data as Record<string, unknown>),
      version: currentVersion + 1,
    });
  }
}
