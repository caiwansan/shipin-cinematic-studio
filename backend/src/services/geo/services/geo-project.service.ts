// ============================================================
// GEO Project Service — Project CRUD + Workspace Runtime Integration
// ============================================================

import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoProjectVersionRepository } from '../repositories/geo-project-version.repository.js'
import { workspaceRuntimeRepository } from '../repositories/workspace-runtime.repository.js'
import { workspaceSnapshotRepository } from '../repositories/workspace-snapshot.repository.js'
import { geoPersistenceService } from './geo-persistence.service.js'
import type { GEOProject } from '../types'
import { getDefaultGEOWorkspaceSettings } from '../registry/geo-registry'

function mapPrismaProject(p: any): GEOProject {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    website: p.website || undefined,
    topic: p.topic || undefined,
    industry: p.industry || undefined,
    language: p.language || 'zh',
    country: p.country || undefined,
    status: p.status,
    config: p.config || {},
    workspaceId: p.workspaceId || undefined,
    deletedAt: p.deletedAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export interface CreateProjectInput {
  name: string
  topic?: string
  userId: string
  language?: string
  industry?: string
  website?: string
  description?: string
  region?: string
  companyType?: string
  primaryLanguage?: string
  config?: Record<string, unknown>
}

export const geoProjectService = {
  /**
   * Create a GEO project, automatically creating a Workspace Runtime workspace.
   */
  async createProject(input: CreateProjectInput): Promise<GEOProject> {
    const { name, topic, userId, language, industry, config, website, description, region, companyType, primaryLanguage } = input

    // First create the GEO project record
    const project = await geoProjectRepository.create({
      userId,
      name,
      website: website || '',
      topic: topic || '',
      language: language || 'zh',
      industry: industry || '',
      config: JSON.parse(JSON.stringify(config || {})),
      status: 'draft',
    })

    // Also create/update the brand setting (GeoBrandSetting) to persist full brand data
    try {
      const { geoBrandSettingRepository } = await import('../repositories/geo-brand-setting.repository.js')
      const existingSetting = await geoBrandSettingRepository.findUnique({ where: { projectId: project.id } })
      if (!existingSetting) {
        await geoBrandSettingRepository.create({
          projectId: project.id,
          brandName: name,
          website: website || '',
          industry: industry || '',
          region: region || '',
          language: primaryLanguage || language || 'zh',
          description: description || '',
        })
      }
    } catch (err) {
      console.error('[GEOProjectService] Failed to create brand setting:', err)
      // Non-fatal: project created, brand setting is supplementary
    }

    // Create workspace via Workspace Runtime
    try {
      const wsData = {
        type: 'geo',
        tenantId: userId,
        name: `GEO: ${name}`,
        description: `GEO project workspace for "${name}"`,
        status: 'active',
        settings: JSON.stringify(getDefaultGEOWorkspaceSettings()),
        metadata: JSON.stringify({
          projectId: project.id,
          moduleId: 'kmki.geo',
          topic: topic || '',
        }),
      }
      console.log('[GEOProjectService] Creating workspace with data:', JSON.stringify(wsData, null, 2))
      const ws = await workspaceRuntimeRepository.create(wsData)

      // Link workspace to project
      const updated = await geoProjectRepository.update(
        { id: project.id },
        { workspaceId: ws.id }
      )

      return updated
    } catch (err) {
      console.error('[GEOProjectService] Failed to create workspace:', err)
      // Still return the project even if workspace creation fails
      return project
    }
  },

  /**
   * Get project by ID.
   */
  async getProject(id: string): Promise<GEOProject | null> {
    const project = await geoProjectRepository.findUnique({ where: { id } })
    if (!project || project.deletedAt) return null
    return project
  },

  /**
   * List projects by userId (tenant).
   */
  async listProjects(tenantId: string): Promise<GEOProject[]> {
    const projects = await geoProjectRepository.findManyWithCounts(tenantId)

    return projects.map((p: any) => ({
      ...mapPrismaProject(p),
      entityCount: p._count.entities,
      relationCount: p._count.relations,
      versionCount: p._count.versions,
    }))
  },

  /**
   * Update project.
   */
  async updateProject(id: string, data: Partial<GEOProject> & { description?: string }): Promise<GEOProject | null> {
    const existing = await geoProjectRepository.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return null

    // Merge description into config (GEOProject has no description column)
    let config = data.config ? JSON.parse(JSON.stringify(data.config)) : undefined
    if (data.description !== undefined) {
      config = config || {}
      config.description = data.description
    }

    const updated = await geoProjectRepository.update(
      { id },
      {
        name: data.name,
        website: data.website,
        topic: data.topic,
        industry: data.industry,
        language: data.language,
        country: data.country,
        status: data.status,
        config,
      }
    )
    return updated
  },

  /**
   * Soft-delete a project.
   */
  async deleteProject(id: string): Promise<boolean> {
    const existing = await geoProjectRepository.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return false

    await geoProjectRepository.update(
      { id },
      { deletedAt: new Date() }
    )
    return true
  },

  /**
   * Get a specific version of a project.
   */
  async getProjectVersion(id: string, version: number): Promise<any | null> {
    const projectVersion = await geoProjectVersionRepository.findUnique({
      where: {
        projectId_version: { projectId: id, version },
      },
    })
    if (!projectVersion) return null
    return {
      id: projectVersion.id,
      projectId: projectVersion.projectId,
      version: projectVersion.version,
      label: projectVersion.label,
      graphData: projectVersion.graphData,
      metadata: projectVersion.metadata,
      snapshotId: projectVersion.snapshotId,
      createdAt: projectVersion.createdAt.toISOString(),
    }
  },

  /**
   * Create a snapshot of the project via Workspace Runtime.
   */
  async snapshotProject(id: string): Promise<any> {
    const { geoEntityRepository } = await import('../repositories/geo-entity.repository.js')
    const { geoEntityRelationRepository } = await import('../repositories/geo-entity-relation.repository.js')

    const project = await geoProjectRepository.findUniqueWithInclude(id)
    if (!project || project.deletedAt) throw new Error('Project not found')

    const entities = await geoEntityRepository.findMany({ where: { projectId: id } })
    const relations = await geoEntityRelationRepository.findMany({ where: { projectId: id } })

    // Build graph data snapshot
    const graphSnapshot = {
      entities: entities.map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        description: e.description,
        provenance: e.provenance,
      })),
      relations: relations.map((r: any) => ({
        id: r.id,
        sourceId: r.sourceId,
        targetId: r.targetId,
        type: r.type,
        lineage: r.lineage,
      })),
    }

    // Get next version number
    const lastVersion = await geoProjectVersionRepository.findFirst({
      where: { projectId: id },
    })
    const nextVersion = (lastVersion?.version || 0) + 1

    // Create a workspace snapshot if workspace exists
    let snapshotId: string | null = null
    if (project.workspaceId) {
      try {
        const snapshot = await workspaceSnapshotRepository.create({
          data: {
            workspaceId: project.workspaceId,
            version: nextVersion,
            label: `GEO v${nextVersion}`,
            runtimeState: JSON.stringify(graphSnapshot),
            assetState: '{}',
            graphState: '{}',
          },
        })
        snapshotId = snapshot.id
      } catch (err) {
        console.error('[GEOProjectService] Failed to create workspace snapshot:', err)
      }
    }

    // Save project version
    const projectVersion = await geoProjectVersionRepository.create({
      data: {
        projectId: id,
        version: nextVersion,
        label: `v${nextVersion}`,
        graphData: graphSnapshot,
        snapshotId,
      },
    })

    return {
      version: projectVersion.version,
      label: projectVersion.label,
      graphSnapshot,
      snapshotId,
    }
  },

  // ──────────────────────────────────────────────
  // P1-A: New methods — Project with reports
  // ──────────────────────────────────────────────

  /**
   * Get project with latest discovery report, action plan, and verification report.
   */
  async getProjectWithReport(projectId: string): Promise<{
    project: GEOProject | null
    discoveryReport: any
    actionPlan: any
    verificationReport: any
  }> {
    const project = await this.getProject(projectId)

    const [discoveryReport, actionPlan, verificationReport] = await Promise.all([
      geoPersistenceService.getDiscoveryReport(projectId),
      geoPersistenceService.getActionPlan(projectId),
      geoPersistenceService.getVerificationReport(projectId),
    ])

    return { project, discoveryReport, actionPlan, verificationReport }
  },

  /**
   * Create a project with default configuration initialized.
   * Falls back to createProject but with industry defaults.
   */
  async createProjectWithDefaults(input: CreateProjectInput): Promise<GEOProject> {
    const defaults = {
      config: {
        ...(input.config || {}),
        defaultScenarios: true,
      },
    }
    return this.createProject({ ...input, ...defaults })
  },
}
