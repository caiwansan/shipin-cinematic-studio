/**
 * SPRINT-ECO-10 — 官方内置插件种子（BUILT_IN 语义）
 * --------------------------------------------------------
 * 定位：插件发现中心首批官方商品（App Store 首批官方应用语义）
 * 纪律：
 *  - manifest 严格遵循 ECO-02 plugin.json schema（只存不执行）
 *  - price 仅登记展示值，不接支付（ECO-06 语义：未接支付实收恒 0）
 *  - 幂等 seed：developer/plugin/version/marketplace item 全部 upsert
 *  - 不新增表；作者 = 官方开发者 kunlun-official（太昊子 / 平台运营方）
 */
import { Prisma } from '@prisma/client';

export interface BuiltinPluginSpec {
  /** manifest.id（小写字母开头，仅小写/数字/连字符） */
  pluginId: string;
  name: string;
  type: 'agent' | 'tool' | 'workflow';
  /** 关联 ecology_applications.slug（需要应用） */
  application: string;
  description: string;
  /** KNOWN_PERMISSIONS 白名单子集 */
  permissions: string[];
  version: string;
  /** 订阅登记价（元/月，仅登记展示，未接支付） */
  price: number;
  icon: string;
}

/** 官方开发者（平台运营方 = 太昊子） */
export const OFFICIAL_DEVELOPER = {
  developerId: 'kunlun-official',
  userId: '0ab83c07-7725-4ee8-a393-bffed8200a59', // 太昊子 User.id
  organizationId: '345fa1ff-4fbb-4846-8bea-f56770d4f2d6', // 太昊子 Organization.id
  developerName: '昆仑镜官方',
} as const;

/**
 * 首批官方插件（掌柜商业模型 2026-08-04）：
 * 免费应用 Kunlun Media 底包 + 付费 AI 员工插件（License 控制）
 */
export const BUILTIN_PLUGINS: BuiltinPluginSpec[] = [
  {
    pluginId: 'ai-content-ops-manager',
    name: 'AI内容运营经理',
    type: 'agent',
    application: 'kunlun-media',
    description: '新媒体内容规划、排期与发布运营的 AI 员工：选题策划、内容日历、发布执行跟踪。',
    permissions: ['content', 'analytics', 'automation'],
    version: '1.0.0',
    price: 599,
    icon: '📋',
  },
  {
    pluginId: 'ai-viral-analyst',
    name: 'AI爆款分析师',
    type: 'agent',
    application: 'kunlun-media',
    description: '爆款选题分析与数据洞察：趋势挖掘、竞品拆解、数据复盘报告。',
    permissions: ['analytics'],
    version: '1.0.0',
    price: 299,
    icon: '📈',
  },
  {
    pluginId: 'ai-video-director',
    name: 'AI短视频导演',
    type: 'agent',
    application: 'kunlun-media',
    description: '短视频脚本与拍摄分镜导演：脚本生成、分镜设计、镜头语言建议。',
    permissions: ['content', 'browser'],
    version: '1.0.0',
    price: 399,
    icon: '🎬',
  },
  {
    pluginId: 'ai-comment-ops',
    name: 'AI评论运营',
    type: 'agent',
    application: 'kunlun-media',
    description: '评论区互动与舆情运营：评论回复、舆情监测、粉丝互动策略。',
    permissions: ['content', 'automation'],
    version: '1.0.0',
    price: 299,
    icon: '💬',
  },
  {
    pluginId: 'ai-matrix-ops',
    name: 'AI矩阵运营团队',
    type: 'agent',
    application: 'kunlun-media',
    description: '多账号矩阵协同运营团队：跨平台账号调度、内容分发、矩阵数据汇总。',
    permissions: ['browser', 'content', 'automation'],
    version: '1.0.0',
    price: 999,
    icon: '🧩',
  },
];

function toJson(input: unknown): Prisma.InputJsonValue {
  return input as Prisma.InputJsonValue;
}

/** 按 ECO-02 schema 构造 manifest（只存不执行） */
function buildManifest(spec: BuiltinPluginSpec) {
  return toJson({
    id: spec.pluginId,
    name: spec.name,
    type: spec.type,
    version: spec.version,
    author: OFFICIAL_DEVELOPER.developerId,
    application: spec.application,
    description: spec.description,
    permissions: spec.permissions,
    runtime: { kaor: true },
    billing: { subscription: true, price: spec.price, currency: 'CNY' },
  });
}

/**
 * 幂等注册官方开发者 + 5 款内置插件 + 上架登记
 * 调用点：ensureEcologySeed（启动时）
 */
export async function seedBuiltinPlugins(prisma: any): Promise<{ plugins: number; items: number }> {
  // 1. 官方开发者（幂等：userId 唯一）
  const dev = await prisma.ecologyDeveloper.findUnique({
    where: { userId: OFFICIAL_DEVELOPER.userId },
  });
  const developer = dev
    ? dev
    : await prisma.ecologyDeveloper.create({
        data: {
          developerId: OFFICIAL_DEVELOPER.developerId,
          userId: OFFICIAL_DEVELOPER.userId,
          organizationId: OFFICIAL_DEVELOPER.organizationId,
          developerName: OFFICIAL_DEVELOPER.developerName,
          status: 'VERIFIED', // 官方开发者直接 VERIFIED（平台自产）
        },
      });

  let plugins = 0;
  let items = 0;
  for (const spec of BUILTIN_PLUGINS) {
    // 2. 插件身份（pluginId 唯一，status=PUBLISHED 已发布可上架）
    const existing = await prisma.ecologyPlugin.findUnique({
      where: { pluginId: spec.pluginId },
    });
    const manifest = buildManifest(spec);
    const plugin = existing
      ? await prisma.ecologyPlugin.update({
          where: { pluginId: spec.pluginId },
          data: {
            name: spec.name,
            type: spec.type,
            author: OFFICIAL_DEVELOPER.developerId,
            description: spec.description,
            manifest,
            status: 'PUBLISHED',
            lifecycleState: 'ACTIVE',
          },
        })
      : await prisma.ecologyPlugin.create({
          data: {
            pluginId: spec.pluginId,
            name: spec.name,
            type: spec.type,
            author: OFFICIAL_DEVELOPER.developerId,
            description: spec.description,
            manifest,
            status: 'PUBLISHED',
            lifecycleState: 'ACTIVE',
            applicationId: await resolveApplicationId(prisma, spec.application),
          },
        });
    plugins++;

    // 3. 版本快照（pluginId+version 唯一）
    await prisma.ecologyPluginVersion.upsert({
      where: {
        pluginId_version: { pluginId: plugin.id, version: spec.version },
      },
      update: { manifest, schemaVersion: '1.0' },
      create: {
        pluginId: plugin.id,
        version: spec.version,
        manifest,
        schemaVersion: '1.0',
        status: 'published',
      },
    });

    // 4. 上架登记（一插件一商品，LISTED）
    const appId = existing?.applicationId ?? plugin.applicationId;
    await prisma.ecologyMarketplaceItem.upsert({
      where: { pluginId: plugin.id },
      update: {
        developerId: developer.id,
        displayName: spec.name,
        description: spec.description,
        category: spec.type,
        pricingModel: 'SUBSCRIPTION',
        price: spec.price,
        status: 'LISTED',
        listedAt: new Date(),
      },
      create: {
        pluginId: plugin.id,
        developerId: developer.id,
        displayName: spec.name,
        description: spec.description,
        category: spec.type,
        pricingModel: 'SUBSCRIPTION',
        price: spec.price,
        status: 'LISTED',
        listedAt: new Date(),
      },
    });
    items++;
    void appId;
  }
  return { plugins, items };
}

async function resolveApplicationId(prisma: any, slug: string): Promise<string | null> {
  const app = await prisma.ecologyApplication.findUnique({ where: { slug } });
  return app?.id ?? null;
}
