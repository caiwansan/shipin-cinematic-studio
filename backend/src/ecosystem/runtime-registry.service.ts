/**
 * SPRINT-ECO-03 — Runtime Capability Registry Service
 * 生态 Runtime 注册表：runtime 身份 / 能力声明 / 插件↔Runtime 映射（G4）
 * 只登记与查询，不执行任何代码。
 */
import type { PrismaClient } from '@prisma/client';
import { KAOR_RUNTIME_SEED, KAOR_CAPABILITIES } from './kaor/kaor-capabilities.js';

export class RuntimeRegistryError extends Error {
  constructor(message: string, public code: string = 'RUNTIME_REGISTRY_ERROR') {
    super(message);
  }
}

export interface RuntimeWithCapabilities {
  runtimeId: string;
  name: string;
  description: string | null;
  version: string;
  adapter: string;
  status: string;
  capabilities: { capability: string; description: string | null; status: string }[];
}

function mapRuntime(r: any, caps: any[]): RuntimeWithCapabilities {
  return {
    runtimeId: r.runtimeId,
    name: r.name,
    description: r.description,
    version: r.version,
    adapter: r.adapter,
    status: r.status,
    capabilities: caps.map((c) => ({
      capability: c.capability,
      description: c.description,
      status: c.status,
    })),
  };
}

/**
 * 幂等注册 KAOR runtime 身份 + 6 项能力声明（seed）
 */
export async function ensureKaorRuntimeSeed(prisma: PrismaClient) {
  const runtime = await prisma.ecologyRuntime.upsert({
    where: { runtimeId: KAOR_RUNTIME_SEED.runtimeId },
    update: {
      name: KAOR_RUNTIME_SEED.name,
      description: KAOR_RUNTIME_SEED.description,
      version: KAOR_RUNTIME_SEED.version,
      adapter: KAOR_RUNTIME_SEED.adapter,
      status: KAOR_RUNTIME_SEED.status,
    },
    create: {
      runtimeId: KAOR_RUNTIME_SEED.runtimeId,
      name: KAOR_RUNTIME_SEED.name,
      description: KAOR_RUNTIME_SEED.description,
      version: KAOR_RUNTIME_SEED.version,
      adapter: KAOR_RUNTIME_SEED.adapter,
      status: KAOR_RUNTIME_SEED.status,
    },
  });

  // 能力声明 upsert（runtime_id + capability 唯一）
  for (const cap of KAOR_CAPABILITIES) {
    await prisma.ecologyRuntimeCapability.upsert({
      where: { runtimeId_capability: { runtimeId: runtime.id, capability: cap.code } },
      update: { description: cap.description, status: cap.status === 'delegated' ? 'active' : 'contract' },
      create: {
        runtimeId: runtime.id,
        capability: cap.code,
        description: cap.description,
        status: cap.status === 'delegated' ? 'active' : 'contract',
      },
    });
  }
  return runtime;
}

export async function listRuntimes(prisma: PrismaClient): Promise<RuntimeWithCapabilities[]> {
  const runtimes = await prisma.ecologyRuntime.findMany({ orderBy: { createdAt: 'asc' } });
  const result: RuntimeWithCapabilities[] = [];
  for (const r of runtimes) {
    const caps = await prisma.ecologyRuntimeCapability.findMany({ where: { runtimeId: r.id } });
    result.push(mapRuntime(r, caps));
  }
  return result;
}

export async function getRuntime(prisma: PrismaClient, runtimeId: string): Promise<RuntimeWithCapabilities | null> {
  const r = await prisma.ecologyRuntime.findUnique({ where: { runtimeId } });
  if (!r) return null;
  const caps = await prisma.ecologyRuntimeCapability.findMany({ where: { runtimeId: r.id } });
  return mapRuntime(r, caps);
}

/**
 * 插件 ↔ Runtime 能力映射（G4）
 * 根据插件 manifest.runtime 声明 + type，映射到 KAOR 能力子集：
 *   agent 类型   → agent.lifecycle + permission + memory（+ workflow 若声明）
 *   workflow 类型 → workflow + scheduler
 *   tool 类型    → tool + permission
 */
export function mapPluginToCapabilities(manifest: any): string[] {
  const type: string = manifest?.type ?? 'tool';
  const runtimeDecl = manifest?.runtime ?? {};
  const caps = new Set<string>();
  if (type === 'agent') {
    caps.add('agent.lifecycle');
    caps.add('permission');
    caps.add('memory');
    if (runtimeDecl?.kaor) caps.add('workflow');
  } else if (type === 'workflow') {
    caps.add('workflow');
    caps.add('scheduler');
    caps.add('permission');
  } else {
    caps.add('tool');
    caps.add('permission');
  }
  return [...caps];
}

/**
 * 建立/更新插件 ↔ KAOR runtime 绑定（幂等）
 * 插件必须已注册（ecology_plugins 存在）
 */
export async function bindPluginToRuntime(
  prisma: PrismaClient,
  pluginId: string,
  runtimeId: string = 'kaor'
) {
  const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId } });
  if (!plugin) {
    throw new RuntimeRegistryError(`插件不存在: ${pluginId}`, 'PLUGIN_NOT_FOUND');
  }
  const runtime = await prisma.ecologyRuntime.findUnique({ where: { runtimeId } });
  if (!runtime) {
    throw new RuntimeRegistryError(`Runtime 不存在: ${runtimeId}`, 'RUNTIME_NOT_FOUND');
  }
  const capabilities = mapPluginToCapabilities(plugin.manifest as any);
  const binding = await prisma.ecologyPluginRuntimeBinding.upsert({
    where: { pluginId_runtimeId: { pluginId: plugin.id, runtimeId: runtime.id } },
    update: { capabilities: JSON.stringify(capabilities), status: 'bound' },
    create: {
      pluginId: plugin.id,
      runtimeId: runtime.id,
      capabilities: JSON.stringify(capabilities),
      status: 'bound',
    },
  });
  return { binding, capabilities };
}

export async function unbindPluginFromRuntime(
  prisma: PrismaClient,
  pluginId: string,
  runtimeId: string = 'kaor'
) {
  const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId } });
  if (!plugin) {
    throw new RuntimeRegistryError(`插件不存在: ${pluginId}`, 'PLUGIN_NOT_FOUND');
  }
  const runtime = await prisma.ecologyRuntime.findUnique({ where: { runtimeId } });
  if (!runtime) {
    throw new RuntimeRegistryError(`Runtime 不存在: ${runtimeId}`, 'RUNTIME_NOT_FOUND');
  }
  const binding = await prisma.ecologyPluginRuntimeBinding.update({
    where: { pluginId_runtimeId: { pluginId: plugin.id, runtimeId: runtime.id } },
    data: { status: 'unbound' },
  });
  return binding;
}

export async function getPluginRuntimeMapping(prisma: PrismaClient, pluginId: string) {
  const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId } });
  if (!plugin) return null;
  const bindings = await prisma.ecologyPluginRuntimeBinding.findMany({
    where: { pluginId: plugin.id, status: 'bound' },
    include: { runtime: true },
  });
  return {
    pluginId: plugin.pluginId,
    pluginType: plugin.type,
    manifestRuntime: (plugin.manifest as any)?.runtime ?? {},
    bindings: bindings.map((b) => ({
      runtimeId: b.runtime.runtimeId,
      runtimeName: b.runtime.name,
      capabilities: JSON.parse(b.capabilities || '[]'),
      status: b.status,
    })),
  };
}
