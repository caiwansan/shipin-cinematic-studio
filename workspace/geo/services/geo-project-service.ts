/**
 * GEO Project Service — GEO-specific project management.
 *
 * Wraps the unified ProjectService with GEO-specific business logic.
 * All HTTP operations go through GEOApiClient. No direct fetch() calls.
 *
 * @package workspace/geo/services
 * @see PLATFORM-SDK.md §3.3
 */

import { ProjectService } from '@studio/platform';
import type { ApiResponse, Project, ProjectCreateInput, ProjectFilter } from '@studio/platform';

/**
 * GEO-specific project metadata.
 */
export interface GEOProjectMetadata {
  /** Target URL for brand analysis */
  targetUrl?: string;
  /** Industry classification */
  industry?: string;
  /** Target market / region */
  targetMarket?: string;
  /** Competitor URLs */
  competitors?: string[];
  /** Keywords to analyze */
  keywords?: string[];
  /** Brand name */
  brandName?: string;
}

/**
 * GEO-specific project extension.
 */
export interface GEOProject extends Project {
  metadata?: GEOProjectMetadata;
}

/**
 * Input for creating a GEO project.
 */
export interface CreateGEOProjectInput {
  name: string;
  description?: string;
  metadata: GEOProjectMetadata;
}

/**
 * GEO Project Service.
 *
 * Wraps the unified ProjectService with GEO-specific logic:
 * - Automatically sets type='geo'
 * - Provides typed metadata interface
 * - Handles GEO-specific validation
 * - Returns ApiResponse format responses
 */
export class GEOProjectService {
  private projectService: ProjectService;

  constructor(projectService: ProjectService) {
    this.projectService = projectService;
  }

  /**
   * Create a new GEO project.
   */
  async create(input: CreateGEOProjectInput, userId: string): Promise<ApiResponse<GEOProject>> {
    // Validate GEO-specific requirements
    if (!input.metadata.targetUrl && !input.metadata.brandName) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'GEO project must provide targetUrl or brandName',
        },
        traceId: this.generateTraceId(),
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
    }

    const createInput: ProjectCreateInput = {
      name: input.name,
      description: input.description,
      type: 'geo',
      metadata: input.metadata as unknown as Record<string, unknown>,
    };

    return this.projectService.create(createInput, userId) as Promise<ApiResponse<GEOProject>>;
  }

  /**
   * Get a GEO project by ID.
   */
  async getById(id: string): Promise<ApiResponse<GEOProject | null>> {
    return this.projectService.getById(id) as Promise<ApiResponse<GEOProject | null>>;
  }

  /**
   * List GEO projects (type='geo').
   */
  async list(filter?: Omit<ProjectFilter, 'type'>): Promise<ApiResponse<GEOProject[]>> {
    const geoFilter: ProjectFilter = {
      ...filter,
      type: 'geo',
    };
    return this.projectService.list(geoFilter) as Promise<ApiResponse<GEOProject[]>>;
  }

  /**
   * Update a GEO project.
   */
  async update(id: string, input: Partial<CreateGEOProjectInput>): Promise<ApiResponse<GEOProject>> {
    const updateInput: Record<string, unknown> = {};
    if (input.name) updateInput.name = input.name;
    if (input.description) updateInput.description = input.description;
    if (input.metadata) {
      updateInput.metadata = { ...input.metadata };
    }

    return this.projectService.update(
      id,
      updateInput as Parameters<typeof this.projectService.update>[1],
    ) as Promise<ApiResponse<GEOProject>>;
  }

  /**
   * Soft-delete a GEO project.
   */
  async softDelete(id: string): Promise<ApiResponse<null>> {
    return this.projectService.softDelete(id);
  }

  // ============ Private Helpers ============

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
