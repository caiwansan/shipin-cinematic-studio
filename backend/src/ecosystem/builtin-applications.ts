/**
 * SPRINT-ECO-01 — 9 个平台内置应用注册（BUILT_IN）
 * 只登记身份，不迁移、不改业务。
 * 注册表：Kunlun Media / Drama / Novel / Recruit / Legal / Mall / Music / Ads / GEO
 */
import { ApplicationAdapter, CapabilityDeclaration, PermissionManifest } from './application-adapter';

export interface BuiltinApplicationSpec {
  slug: string;
  name: string;
  category: string;
  description: string;
  workspaceEntry: string;
  backendModule: string;
  icon?: string;
  capabilities: CapabilityDeclaration[];
  permissions: PermissionManifest[];
}

/** 9 内置应用规格（身份 SSOT，未来开发者应用走 EcologyPlugin/生态注册，不进此表） */
export const BUILTIN_APPLICATIONS: BuiltinApplicationSpec[] = [
  {
    slug: 'kunlun-media',
    name: 'Kunlun Media',
    category: 'media',
    description: '新媒体运营工作台：账号管理、内容管理、基础发布、数据查看（免费底包）；AI 员工插件付费',
    workspaceEntry: '/workspace/media',
    backendModule: 'enterprise/channel',
    capabilities: [
      { code: 'media.read_metrics', name: '数据查看', description: '读取平台账号粉丝/作品数据', mountPoint: 'media.analytics' },
      { code: 'media.manage_accounts', name: '账号管理', description: '多平台账号登录态管理', mountPoint: 'media.accounts' },
      { code: 'media.publish_content', name: '基础发布', description: '内容发布（基础能力）', mountPoint: 'media.publish' },
      { code: 'media.manage_content', name: '内容管理', description: '素材与作品管理', mountPoint: 'media.content' },
    ],
    permissions: [
      { permission: 'browser', name: '浏览器控制', description: '控制本地浏览器访问平台账号' },
      { permission: 'content', name: '内容读写', description: '读写内容素材' },
      { permission: 'analytics', name: '数据分析', description: '读取经营数据' },
    ],
  },
  {
    slug: 'kunlun-drama',
    name: 'Kunlun Drama',
    category: 'drama',
    description: '短剧创作工作台：剧本、分镜、AI 视频生产',
    workspaceEntry: '/studio/v2',
    backendModule: 'studio-v2',
    capabilities: [
      { code: 'drama.storyboard', name: '分镜设计', description: '分镜脚本与镜头设计', mountPoint: 'drama.storyboard' },
      { code: 'drama.production', name: 'AI 视频生产', description: 'AI 生成视频片段', mountPoint: 'drama.production' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写剧本与素材' },
      { permission: 'media_generate', name: 'AI 生成', description: '调用 AI 视频生成能力' },
    ],
  },
  {
    slug: 'kunlun-novel',
    name: 'Kunlun Novel',
    category: 'novel',
    description: '小说创作工作台：混沌珠世界观、大纲、章节写作',
    workspaceEntry: '/hdz',
    backendModule: 'hdz',
    capabilities: [
      { code: 'novel.outline', name: '大纲创作', description: '世界观与大纲', mountPoint: 'novel.outline' },
      { code: 'novel.chapters', name: '章节写作', description: '章节生成与编辑', mountPoint: 'novel.chapters' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写小说内容' },
    ],
  },
  {
    slug: 'kunlun-recruit',
    name: 'Kunlun Recruit',
    category: 'recruit',
    description: '招聘工作台：AI 招聘官、简历中心、面试中心',
    workspaceEntry: '/workspace/recruitment',
    backendModule: 'enterprise/recruitment',
    capabilities: [
      { code: 'recruit.candidates', name: '候选人管理', description: '简历与候选人', mountPoint: 'recruit.candidates' },
      { code: 'recruit.interview', name: '面试流程', description: '面试安排与评估', mountPoint: 'recruit.interview' },
      { code: 'recruit.jd_generate', name: 'JD 生成', description: 'AI 生成岗位描述', mountPoint: 'recruit.jd' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写候选人数据' },
      { permission: 'analytics', name: '数据分析', description: '招聘漏斗分析' },
    ],
  },
  {
    slug: 'kunlun-legal',
    name: 'Kunlun Legal',
    category: 'legal',
    description: '法律工作台：合同与法律文书处理',
    workspaceEntry: '/workspace/legal',
    backendModule: 'enterprise/legal',
    capabilities: [
      { code: 'legal.contracts', name: '合同处理', description: '合同审核与生成', mountPoint: 'legal.contracts' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写法律文书' },
    ],
  },
  {
    slug: 'kunlun-mall',
    name: 'Kunlun Mall',
    category: 'mall',
    description: '商城工作台：商品与订单管理',
    workspaceEntry: '/mall',
    backendModule: 'enterprise/mall',
    capabilities: [
      { code: 'mall.products', name: '商品管理', description: '商品上下架', mountPoint: 'mall.products' },
      { code: 'mall.orders', name: '订单管理', description: '订单处理', mountPoint: 'mall.orders' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写商品数据' },
    ],
  },
  {
    slug: 'kunlun-music',
    name: 'Kunlun Music',
    category: 'music',
    description: '音乐工作台：音乐创作与音频资产',
    workspaceEntry: '/workspace/music',
    backendModule: 'enterprise/music',
    capabilities: [
      { code: 'music.tracks', name: '音轨管理', description: '音频资产管理', mountPoint: 'music.tracks' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写音频资产' },
    ],
  },
  {
    slug: 'kunlun-ads',
    name: 'Kunlun Ads',
    category: 'ad',
    description: '广告工作台：投放管理与效果分析',
    workspaceEntry: '/workspace/ad-create',
    backendModule: 'enterprise/ad',
    capabilities: [
      { code: 'ad.campaigns', name: '投放管理', description: '广告投放管理', mountPoint: 'ad.campaigns' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写投放数据' },
      { permission: 'analytics', name: '数据分析', description: '投放效果分析' },
    ],
  },
  {
    slug: 'kunlun-geo',
    name: 'Kunlun GEO',
    category: 'geo',
    description: 'GEO 工作台：AI 生成式引擎优化',
    workspaceEntry: '/workspace/geo/dashboard',
    backendModule: 'enterprise/geo',
    capabilities: [
      { code: 'geo.audit', name: 'GEO 审计', description: '品牌可见性审计', mountPoint: 'geo.audit' },
      { code: 'geo.reports', name: '报告生成', description: 'GEO 分析报告', mountPoint: 'geo.reports' },
    ],
    permissions: [
      { permission: 'content', name: '内容读写', description: '读写审计数据' },
      { permission: 'analytics', name: '数据分析', description: '可见性分析' },
    ],
  },
];

/** 按 slug 查找内置应用规格 */
export function getBuiltinApplication(slug: string): BuiltinApplicationSpec | undefined {
  return BUILTIN_APPLICATIONS.find((a) => a.slug === slug);
}
