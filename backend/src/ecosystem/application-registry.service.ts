/**
 * SPRINT-ECO-01 — Application Registry Service
 * 应用身份注册服务：幂等注册 9 内置应用 + 版本 + 查询。
 * 只登记身份，不迁移、不改业务。
 */
import { prisma } from '../utils/index.js';
import { BUILTIN_APPLICATIONS } from './builtin-applications.js';
import type { Prisma } from '@prisma/client';

/** 能力/权限声明 → Prisma Json 输入（InputJsonValue 兼容） */
function toJson(input: unknown): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}

/** 幂等注册全部内置应用（BUILT_IN 状态，slug upsert 语义） */
export async function seedBuiltinApplications(): Promise<{ registered: number; skipped: number }> {
  let registered = 0;
  let skipped = 0;
  for (const spec of BUILTIN_APPLICATIONS) {
    const existing = await prisma.ecologyApplication.findUnique({ where: { slug: spec.slug } });
    if (existing) {
      // 已存在 → 只补齐字段（不覆盖业务状态）
      await prisma.ecologyApplication.update({
        where: { slug: spec.slug },
        data: {
          name: spec.name,
          category: spec.category,
          description: spec.description,
          workspaceEntry: spec.workspaceEntry,
          backendModule: spec.backendModule,
          isPlatformBuiltIn: true,
        },
      });
      skipped++;
      continue;
    }

    const app = await prisma.ecologyApplication.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        workspaceEntry: spec.workspaceEntry,
        backendModule: spec.backendModule,
        isPlatformBuiltIn: true,
        status: 'BUILT_IN',
        lifecycleState: 'ACTIVE',
        metadata: toJson({
          capabilities: spec.capabilities,
          permissions: spec.permissions,
        }),
      },
    });

    // 初始版本 1.0.0（能力声明快照）
    await prisma.ecologyApplicationVersion.upsert({
      where: { applicationId_version: { applicationId: app.id, version: '1.0.0' } },
      update: {
        frontendEntry: spec.workspaceEntry,
        backendModule: spec.backendModule,
        manifest: toJson({ capabilities: spec.capabilities, permissions: spec.permissions }),
        status: 'released',
      },
      create: {
        applicationId: app.id,
        version: '1.0.0',
        frontendEntry: spec.workspaceEntry,
        backendModule: spec.backendModule,
        manifest: toJson({ capabilities: spec.capabilities, permissions: spec.permissions }),
        status: 'released',
      },
    });
    registered++;
  }
  return { registered, skipped };
}

/** 查询全部应用（含版本数） */
export async function listApplications() {
  const apps = await prisma.ecologyApplication.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  return apps.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    icon: a.icon,
    description: a.description,
    category: a.category,
    isPlatformBuiltIn: a.isPlatformBuiltIn,
    status: a.status,
    lifecycleState: a.lifecycleState,
    workspaceEntry: a.workspaceEntry,
    backendModule: a.backendModule,
    latestVersion: a.versions[0]?.version ?? null,
    capabilities: (a.metadata as any)?.capabilities ?? [],
    permissions: (a.metadata as any)?.permissions ?? [],
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

/** 查询单应用详情（含全部版本） */
export async function getApplicationBySlug(slug: string) {
  const app = await prisma.ecologyApplication.findUnique({
    where: { slug },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!app) return null;
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    icon: app.icon,
    description: app.description,
    category: app.category,
    isPlatformBuiltIn: app.isPlatformBuiltIn,
    status: app.status,
    lifecycleState: app.lifecycleState,
    workspaceEntry: app.workspaceEntry,
    backendModule: app.backendModule,
    versions: app.versions.map((v) => ({
      version: v.version,
      changelog: v.changelog,
      frontendEntry: v.frontendEntry,
      manifest: v.manifest,
      status: v.status,
      createdAt: v.createdAt,
    })),
    capabilities: (app.metadata as any)?.capabilities ?? [],
    permissions: (app.metadata as any)?.permissions ?? [],
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

/** 组织安装应用（幂等：已安装返回现有记录） */
export async function installApplicationForOrg(organizationId: string, slug: string) {
  const app = await prisma.ecologyApplication.findUnique({ where: { slug } });
  if (!app) return { ok: false as const, reason: 'APPLICATION_NOT_FOUND' };

  const latestVersion = await prisma.ecologyApplicationVersion.findFirst({
    where: { applicationId: app.id, status: 'released' },
    orderBy: { version: 'desc' },
  });

  const existing = await prisma.ecologyApplicationInstall.findUnique({
    where: { organizationId_applicationId: { organizationId, applicationId: app.id } },
  });
  if (existing) {
    return { ok: true as const, install: existing, reused: true as const };
  }

  const install = await prisma.ecologyApplicationInstall.create({
    data: {
      organizationId,
      applicationId: app.id,
      versionId: latestVersion?.id ?? null,
      status: 'ACTIVE',
      lifecycleState: 'INSTALLED',
    },
  });
  return { ok: true as const, install, reused: false as const };
}

/** 组织应用安装状态（用于应用中心展示） */
export async function listOrgInstallations(organizationId: string) {
  const installs = await prisma.ecologyApplicationInstall.findMany({
    where: { organizationId },
    include: { application: true },
    orderBy: { installedAt: 'desc' },
  });
  return installs.map((i) => ({
    applicationId: i.applicationId,
    slug: i.application.slug,
    name: i.application.name,
    category: i.application.category,
    status: i.status,
    lifecycleState: i.lifecycleState,
    installedAt: i.installedAt,
    lastUsedAt: i.lastUsedAt,
  }));
}
