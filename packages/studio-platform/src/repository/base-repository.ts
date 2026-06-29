/**
 * BaseRepository — Abstract data access layer for all domain models.
 *
 * All concrete repositories MUST extend this class.
 * Workspace code MUST NOT import prisma directly.
 *
 * Uses ORMAdapter interface for ORM-agnostic data access.
 * Prisma is the default implementation (PrismaAdapter), but the interface
 * allows swapping to Drizzle, Kysely, or any other ORM.
 *
 * @package @studio/platform/repository
 * @see DATA-SPEC.md §2 (Repository → ORM Adapter pattern)
 * @see ADR-004 (Repository + ORM Adapter)
 */

/**
 * ORMAdapter — Abstraction for database access.
 *
 * Defines the minimal interface that any ORM must implement
 * to work with BaseRepository.
 */
export interface ORMAdapter {
  /** Create a single record */
  create<T>(tableName: string, data: unknown): Promise<T>;
  /** Create multiple records */
  createMany<T>(tableName: string, data: unknown[]): Promise<number>;
  /** Find a record by ID (excludes soft-deleted) */
  findById<T>(tableName: string, id: string): Promise<T | null>;
  /** Find records matching conditions */
  findMany<T>(
    tableName: string,
    where?: Record<string, unknown>,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }
  ): Promise<T[]>;
  /** Update a record by ID */
  update<T>(tableName: string, id: string, data: unknown): Promise<T>;
  /** Soft-delete a record by ID */
  softDelete(tableName: string, id: string): Promise<void>;
  /** Update with optimistic locking */
  updateWithVersion<T>(
    tableName: string,
    id: string,
    version: number,
    data: unknown
  ): Promise<T>;
}

/**
 * Abstract base class for all domain repositories.
 *
 * Implements the Template Method pattern:
 * - Subclasses define mapPrisma, toCreateInput, toUpdateInput, tableName
 * - Base class provides standard CRUD + soft delete + versioning
 *
 * @template TDomain - Domain model type (e.g., Project, KnowledgeClaim)
 * @template TPrisma - Prisma/ORM record type
 */
export abstract class BaseRepository<TDomain, TPrisma> {
  protected abstract tableName: string;
  protected orm: ORMAdapter;

  constructor(orm: ORMAdapter) {
    this.orm = orm;
  }

  // ============ Abstract Methods (Subclass Must Implement) ============

  /** Map ORM record → domain model */
  protected abstract mapPrisma(record: TPrisma): TDomain;

  /** Domain model → ORM create input */
  protected abstract toCreateInput(data: Partial<TDomain>): unknown;

  /** Domain model → ORM update input */
  protected abstract toUpdateInput(data: Partial<TDomain>): unknown;

  // ============ Public CRUD Methods ============

  /**
   * Create a new record.
   */
  async create(data: Partial<TDomain>): Promise<TDomain> {
    const record = await this.orm.create<TPrisma>(
      this.tableName,
      this.toCreateInput(data)
    );
    return this.mapPrisma(record);
  }

  /**
   * Create multiple records in batch.
   */
  async createMany(data: Partial<TDomain>[]): Promise<number> {
    return this.orm.createMany(
      this.tableName,
      data.map((d) => this.toCreateInput(d))
    );
  }

  /**
   * Find a record by its ID.
   * Excludes soft-deleted records.
   */
  async findById(id: string): Promise<TDomain | null> {
    const record = await this.orm.findById<TPrisma>(this.tableName, id);
    return record ? this.mapPrisma(record) : null;
  }

  /**
   * Find records matching the given conditions.
   */
  async findMany(
    where?: Partial<TDomain>,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }
  ): Promise<TDomain[]> {
    const records = await this.orm.findMany<TPrisma>(
      this.tableName,
      where as Record<string, unknown>,
      options
    );
    return records.map((r) => this.mapPrisma(r));
  }

  /**
   * Update a record by its ID.
   */
  async update(id: string, data: Partial<TDomain>): Promise<TDomain> {
    const record = await this.orm.update<TPrisma>(
      this.tableName,
      id,
      this.toUpdateInput(data)
    );
    return this.mapPrisma(record);
  }

  /**
   * Soft-delete a record by its ID.
   * Sets deletedAt timestamp instead of hard deletion.
   */
  async softDelete(id: string): Promise<void> {
    await this.orm.softDelete(this.tableName, id);
  }

  /**
   * Update with optimistic locking.
   * Throws an error if the version doesn't match (stale data).
   */
  async updateWithVersion(
    id: string,
    version: number,
    data: Partial<TDomain>
  ): Promise<TDomain> {
    return this.orm.updateWithVersion<TPrisma>(
      this.tableName,
      id,
      version,
      this.toUpdateInput(data)
    );
  }
}
