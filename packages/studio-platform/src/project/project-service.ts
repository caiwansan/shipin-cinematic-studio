/**
 * Unified Project Service.
 *
 * The entire platform has exactly ONE Project model.
 * Workspace type is distinguished by Project.type enum, not separate tables.
 *
 * @package @studio/platform/project
 * @see DATA-SPEC.md §1 (Single Project Table)
 * @see MANIFESTO.md §4 (Platform Owns Project)
 */

import type { ApiResponse } from '../api/types';
import type { BaseRepository } from '../repository/base-repository';

// ============ Types ============

/**
 * All supported workspace types for the platform.
 * Projects are distinguished by type, not by separate tables.
 */
export type WorkspaceType = 'geo' | 'video' | 'novel' | 'ppt' | 'music' | 'image';

/**
 * Project lifecycle statuses.
 */
export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

/**
 * Unified Project model.
 * Every workspace uses this same model — no separate GEOProject/VideoProject tables.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  type: WorkspaceType;
  status: ProjectStatus;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/**
 * Input for creating a new project.
 */
export interface ProjectCreateInput {
  name: string;
  description?: string;
  type: WorkspaceType;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing project.
 */
export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Filter for querying projects.
 */
export interface ProjectFilter {
  type?: WorkspaceType;
  status?: ProjectStatus;
  userId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

// ============ Service ============

/**
 * Unified Project Service.
 *
 * Handles all project CRUD operations through the Repository pattern.
 * No direct Prisma access — operations go through BaseRepository.
 *
 * C1 implementation: uses a repository adapter.
 * C2+ implementation: wired to real database via BaseRepository.
 */
export class ProjectService {
  private repository: BaseRepository<Project, unknown>;

  constructor(repository: BaseRepository<Project, unknown>) {
    this.repository = repository;
  }

  /**
   * Create a new project.
   */
  async create(input: ProjectCreateInput, userId: string): Promise<ApiResponse<Project>> {
    try {
      const project = await this.repository.create({
        name: input.name,
        description: input.description,
        type: input.type,
        userId,
        status: 'draft',
        metadata: input.metadata ?? {},
      });

      return this.successResponse(project);
    } catch (error) {
      return this.errorResponse('BUSINESS_ERROR', '创建项目失败', error);
    }
  }

  /**
   * Get a project by its ID.
   */
  async getById(id: string): Promise<ApiResponse<Project | null>> {
    try {
      const project = await this.repository.findById(id);
      return this.successResponse(project);
    } catch (error) {
      return this.errorResponse('NOT_FOUND', `项目不存在: ${id}`, error);
    }
  }

  /**
   * List projects matching the given filter.
   */
  async list(filter: ProjectFilter): Promise<ApiResponse<Project[]>> {
    try {
      const where: Record<string, unknown> = {};
      if (filter.type) where.type = filter.type;
      if (filter.status) where.status = filter.status;
      if (filter.userId) where.userId = filter.userId;

      const projects = await this.repository.findMany(where as Partial<Project>, {
        skip: filter.page ? (filter.page - 1) * (filter.pageSize ?? 20) : 0,
        take: filter.pageSize ?? 20,
        orderBy: filter.sortBy
          ? { [filter.sortBy]: filter.sortOrder ?? 'desc' }
          : undefined,
      });

      return this.successResponse(projects);
    } catch (error) {
      return this.errorResponse('INTERNAL_ERROR', '查询项目列表失败', error);
    }
  }

  /**
   * Update an existing project.
   */
  async update(id: string, input: ProjectUpdateInput): Promise<ApiResponse<Project>> {
    try {
      const project = await this.repository.update(id, input);
      return this.successResponse(project);
    } catch (error) {
      return this.errorResponse('BUSINESS_ERROR', '更新项目失败', error);
    }
  }

  /**
   * Soft-delete a project.
   */
  async softDelete(id: string): Promise<ApiResponse<null>> {
    try {
      await this.repository.softDelete(id);
      return this.successResponse(null);
    } catch (error) {
      return this.errorResponse('NOT_FOUND', `删除项目失败: ${id}`, error);
    }
  }

  // ============ Private Helpers ============

  private successResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      traceId: this.generateTraceId(),
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
  }

  private errorResponse(code: string, message: string, error: unknown): never {
    throw {
      code,
      message,
      details: error instanceof Error ? { message: error.message } : undefined,
    };
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
