/**
 * F5 Permission Graph Engine — 权限图引擎
 *
 * Org → Workspace → Project → Asset/Job 图遍历
 * RBAC + 继承链
 */

import { prisma } from '../utils/index.js'

export type PermissionLevel = 'owner' | 'admin' | 'editor' | 'viewer'
export type ResourceType = 'organization' | 'workspace' | 'project' | 'asset' | 'job'

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  owner: 100,
  admin: 80,
  editor: 50,
  viewer: 10,
}

export class PermissionGraphEngine {
  /**
   * 检查用户对资源的访问权限
   */
  async checkAccess(params: {
    userId: string
    resourceType: ResourceType
    resourceId: string
    requiredLevel: PermissionLevel
  }): Promise<boolean> {
    const actualLevel = await this.resolvePermission(
      params.userId,
      params.resourceType,
      params.resourceId,
    )

    if (!actualLevel) return false

    return PERMISSION_HIERARCHY[actualLevel] >= PERMISSION_HIERARCHY[params.requiredLevel]
  }

  /**
   * 解析用户对资源的实际权限（图遍历）
   */
  async resolvePermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<PermissionLevel | null> {
    switch (resourceType) {
      case 'project':
        return this.resolveProjectPermission(userId, resourceId)
      case 'workspace':
        return this.resolveWorkspacePermission(userId, resourceId)
      case 'organization':
        return this.resolveOrgPermission(userId, resourceId)
      case 'asset':
        return this.resolveAssetPermission(userId, resourceId)
      default:
        return 'viewer'
    }
  }

  /**
   * 直接查询用户在组织中的角色
   */
  async getOrgRole(userId: string, orgId: string): Promise<PermissionLevel | null> {
    const member = await prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    })
    return (member?.role as PermissionLevel) ?? null
  }

  private async resolveProjectPermission(userId: string, projectId: string): Promise<PermissionLevel | null> {
    // 1. 直接所有者
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, workspaceId: true },
    })
    if (!project) return null
    if (project.userId === userId) return 'owner'

    // 2. 通过 Workspace 继承
    if (project.workspaceId) {
      const wsPerm = await this.resolveWorkspacePermission(userId, project.workspaceId)
      if (wsPerm && PERMISSION_HIERARCHY[wsPerm] >= PERMISSION_HIERARCHY.editor) {
        return wsPerm
      }
    }

    return null
  }

  private async resolveWorkspacePermission(userId: string, workspaceId: string): Promise<PermissionLevel | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    })
    if (!workspace) return null

    // 继承 Org 权限
    return this.resolveOrgPermission(userId, workspace.organizationId)
  }

  private async resolveOrgPermission(userId: string, orgId: string): Promise<PermissionLevel | null> {
    return this.getOrgRole(userId, orgId)
  }

  private async resolveAssetPermission(userId: string, assetId: string): Promise<PermissionLevel | null> {
    const asset = await prisma.assetRegistry.findUnique({
      where: { id: assetId },
      select: { projectId: true },
    })
    if (!asset) return null
    return this.resolveProjectPermission(userId, asset.projectId)
  }

  /**
   * 获取用户在系统中的完整权限图谱
   */
  async getUserPermissionGraph(userId: string): Promise<{
    organizations: Array<{ id: string; name: string; role: string }>
    workspaces: Array<{ id: string; name: string; role: string }>
    projects: Array<{ id: string; name: string; role: string }>
  }> {
    const orgs = await prisma.orgMember.findMany({
      where: { userId },
      include: { organization: { select: { name: true } } },
    })

    const workspaceMemberships = await prisma.workspace.findMany({
      where: { organizationId: { in: orgs.map(o => o.organizationId) } },
      select: { id: true, name: true, organizationId: true },
    })

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId },
          { workspaceId: { in: workspaceMemberships.map(w => w.id) } },
        ],
      },
      select: { id: true, name: true, userId: true, workspaceId: true },
      take: 100,
    })

    return {
      organizations: orgs.map(o => ({
        id: o.organizationId,
        name: o.organization.name,
        role: o.role,
      })),
      workspaces: workspaceMemberships.map(w => ({
        id: w.id,
        name: w.name,
        role: orgs.find(o => o.organizationId === w.organizationId)?.role || 'viewer',
      })),
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        role: p.userId === userId ? 'owner' : 'editor',
      })),
    }
  }
}

export const permissionGraphEngine = new PermissionGraphEngine()
