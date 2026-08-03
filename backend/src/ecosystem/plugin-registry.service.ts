/**
 * ECO-02 Plugin Registry Service — 插件身份注册中心
 * -------------------------------------------------
 * 只登记身份，不执行插件 / 不运行第三方代码 / 不接入支付
 * 职责：
 *  - registerPlugin: 校验 manifest → 幂等 upsert 插件身份 + 版本
 *  - listPlugins: 插件目录（含组织安装状态）
 *  - getPlugin: 插件详情（含版本历史）
 *  - installPlugin: 登记安装（幂等，只写 install 记录）
 *  - uninstallPlugin: 登记卸载（只标记状态，不执行任何代码）
 */
import { prisma } from '../utils/index.js';
import { validatePluginManifest } from './plugin-manifest.schema.js';

export class PluginRegistryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PluginRegistryError';
  }
}

/** 注册插件（幂等：同 id 重复注册 → 新版本 upsert，身份复用） */
export async function registerPlugin(rawManifest: unknown) {
  const result = validatePluginManifest(rawManifest);
  if (!result.valid || !result.manifest) {
    throw new PluginRegistryError(`manifest 校验失败: ${result.errors.join('; ')}`, 'INVALID_MANIFEST');
  }
  const m = result.manifest;

  // application 关联：如声明 application，须存在于 ecology_applications
  let applicationId: string | null = null;
  if (m.application) {
    const app = await prisma.ecologyApplication.findUnique({ where: { slug: m.application } });
    if (!app) {
      throw new PluginRegistryError(`application 不存在: ${m.application}`, 'APPLICATION_NOT_FOUND');
    }
    applicationId = app.id;
  }

  // 幂等：plugin_id 唯一 → 身份复用，版本 upsert
  // ⚠️ 冒名防线：同 id 但 author 不一致 → 拒绝（防止任何人覆盖他人插件身份）
  const existing = await prisma.ecologyPlugin.findUnique({ where: { pluginId: m.id } });
  if (existing && existing.author !== m.author) {
    throw new PluginRegistryError(
      `插件ID已被占用: ${m.id}（author 不一致，拒绝冒名注册）`,
      'PLUGIN_ID_CONFLICT'
    );
  }

  let plugin;
  if (existing) {
    plugin = await prisma.ecologyPlugin.update({
      where: { id: existing.id },
      data: {
        name: m.name,
        type: m.type,
        author: m.author,
        applicationId,
        manifest: m as unknown as object,
        lifecycleState: 'ACTIVE',
        status: existing.status === 'DEPRECATED' ? 'REGISTERED' : existing.status,
      },
    });
  } else {
    plugin = await prisma.ecologyPlugin.create({
      data: {
        pluginId: m.id,
        name: m.name,
        type: m.type,
        author: m.author,
        applicationId,
        manifest: m as unknown as object,
        status: 'REGISTERED',
        lifecycleState: 'ACTIVE',
      },
    });
  }

  // 版本 upsert（plugin_id + version 唯一）
  await prisma.ecologyPluginVersion.upsert({
    where: { pluginId_version: { pluginId: plugin.id, version: m.version } },
    create: {
      pluginId: plugin.id,
      version: m.version,
      manifest: m as unknown as object,
      status: 'published',
    },
    update: {
      manifest: m as unknown as object,
      status: 'published',
    },
  });

  return { plugin, reused: !!existing, newVersion: true };
}

/** 插件目录（含组织安装状态） */
export async function listPlugins(orgId?: string) {
  const plugins = await prisma.ecologyPlugin.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      application: { select: { slug: true, name: true, icon: true } },
      versions: { select: { id: true, version: true, status: true, createdAt: true }, orderBy: { version: 'desc' } },
      installs: orgId ? { where: { organizationId: orgId }, select: { id: true, status: true, lifecycleState: true, installedAt: true } } : false,
    },
  });
  return plugins.map((p) => ({
    id: p.pluginId,
    name: p.name,
    type: p.type,
    author: p.author,
    description: p.description,
    application: p.application ? { slug: p.application.slug, name: p.application.name } : null,
    latestVersion: p.versions[0]?.version ?? null,
    status: p.status,
    lifecycleState: p.lifecycleState,
    permissions: (p.manifest as any)?.permissions ?? [],
    billing: (p.manifest as any)?.billing ?? null,
    installed: Array.isArray(p.installs) && p.installs.length > 0 ? p.installs[0] : null,
  }));
}

/** 插件详情（含版本历史） */
export async function getPlugin(pluginId: string, orgId?: string) {
  const plugin = await prisma.ecologyPlugin.findUnique({
    where: { pluginId },
    include: {
      application: { select: { slug: true, name: true, icon: true } },
      versions: { orderBy: { version: 'desc' } },
      installs: orgId ? { where: { organizationId: orgId } } : false,
    },
  });
  if (!plugin) return null;
  return {
    id: plugin.pluginId,
    name: plugin.name,
    type: plugin.type,
    author: plugin.author,
    description: plugin.description,
    application: plugin.application ? { slug: plugin.application.slug, name: plugin.application.name } : null,
    status: plugin.status,
    lifecycleState: plugin.lifecycleState,
    manifest: plugin.manifest,
    versions: plugin.versions.map((v) => ({ version: v.version, status: v.status, changelog: v.changelog, createdAt: v.createdAt })),
    installed: Array.isArray(plugin.installs) && plugin.installs.length > 0 ? plugin.installs[0] : null,
  };
}

/** 登记安装（幂等，只写记录不执行任何代码） */
export async function installPlugin(orgId: string, pluginId: string) {
  const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId } });
  if (!plugin) throw new PluginRegistryError(`插件不存在: ${pluginId}`, 'PLUGIN_NOT_FOUND');

  const latest = await prisma.ecologyPluginVersion.findFirst({
    where: { pluginId: plugin.id },
    orderBy: { version: 'desc' },
  });

  const install = await prisma.ecologyPluginInstall.upsert({
    where: { organizationId_pluginId: { organizationId: orgId, pluginId: plugin.id } },
    create: {
      organizationId: orgId,
      pluginId: plugin.id,
      versionId: latest?.id ?? null,
      status: 'INSTALLED',
      lifecycleState: 'ACTIVE',
    },
    update: {
      status: 'INSTALLED',
      lifecycleState: 'ACTIVE',
      versionId: latest?.id ?? undefined,
      lastUsedAt: new Date(),
    },
  });

  return { install, reused: true, pluginId };
}

/** 登记卸载（只标记状态，不执行任何代码） */
export async function uninstallPlugin(orgId: string, pluginId: string) {
  const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId } });
  if (!plugin) throw new PluginRegistryError(`插件不存在: ${pluginId}`, 'PLUGIN_NOT_FOUND');

  const install = await prisma.ecologyPluginInstall.findUnique({
    where: { organizationId_pluginId: { organizationId: orgId, pluginId: plugin.id } },
  });
  if (!install) throw new PluginRegistryError(`插件未安装: ${pluginId}`, 'PLUGIN_NOT_INSTALLED');

  return prisma.ecologyPluginInstall.update({
    where: { id: install.id },
    data: { status: 'UNINSTALLED', lifecycleState: 'DEPRECATED' },
  });
}
