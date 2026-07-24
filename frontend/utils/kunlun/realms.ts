/**
 * 昆仑镜 — Realm Registry
 *
 * 创世五境 —— 昆仑镜五大创作领域的统一注册表
 * 所有工作台路由从此读取，禁止在组件内写死路径
 *
 * 新增工作台只需在此注册，首页自动扩展（零组件改动）
 */

export type RealmStatus = 'stable' | 'beta' | 'preview' | 'hidden' | 'deprecated'

export interface RealmDefinition {
  /** 唯一标识 */
  id: string
  /** 境界名（中文） */
  realm: string
  /** 产品名 */
  title: string
  /** 一句话描述 */
  subtitle: string
  /** 详细描述（用于展开态卡片） */
  description: string
  /** 境界宣言（一句话霸气文案） */
  manifesto: string
  /** emoji */
  icon: string
  /** 前端路由（可同步字符串，也可异步 lazy resolve） */
  route: string | (() => Promise<string>)
  /** 主题色 CSS color */
  color: string
  /** 是否启用（已废弃，改用 status） */
  enabled: boolean
  /** 工作台状态 */
  status: RealmStatus
  /** 排序 */
  order: number
  /** 标签（如 "全新" / "Beta"） */
  tag?: string
  /** 状态提示文案 */
  statusNotice?: string
}

/**
 * realm 路由解析器
 * 支持同步字符串和异步 lazy resolve
 */
export async function resolveRealmRoute(realm: RealmDefinition): Promise<string> {
  if (typeof realm.route === 'function') {
    return await realm.route()
  }
  return realm.route
}

/**
 * Realm Registry — 唯一真相源
 *
 * 新增工作台在此追加条目，首页自动扩展
 * 禁止在组件内写死路由路径
 */
export const REALMS: RealmDefinition[] = [
  {
    id: 'drama',
    realm: '影界',
    title: 'AI 短剧',
    subtitle: '从剧本到成片，AI 导演全流程',
    description: '输入故事梗概，AI 自动生成剧本、角色设计、场景匹配、分镜规划、图片生成、TTS 配音到视频合成，一站式完成。',
    manifesto: '一人即是整个剧组',
    icon: '🎬',
    route: '/studio/v2',
    color: '#00D4FF',
    enabled: true,
    status: 'beta',
    order: 1,
    tag: 'Beta',
    statusNote: '公测版，BYOK，Pro 临时策略',
  },
  {
    id: 'novel',
    realm: '文界',
    title: 'AI 小说',
    subtitle: '文曲星引擎 · 千万字记忆',
    description: '基于文曲星长期记忆引擎，支持千万字级上下文。AI 辅助写作、角色一致性保持、伏笔自动召回。',
    manifesto: '过目不忘，方为大家',
    icon: '📖',
    route: '/hdz',
    color: '#C9A86C',
    enabled: true,
    status: 'stable',
    order: 2,
  },
  {
    id: 'ppt',
    realm: '演界',
    title: 'AI PPT',
    subtitle: 'Agent 群协同 · 自动排版配图',
    description: '多 Agent 协作：大纲 Agent 规划结构、内容 Agent 撰写文案、视觉 Agent 生成配图、布局 Agent 自动排版。',
    manifesto: '让每个想法都有舞台',
    icon: '🍌',
    route: '/ppt/',
    color: '#A78BFA',
    enabled: true,
    status: 'stable',
    order: 3,
  },
  {
    id: 'music',
    realm: '乐界',
    title: 'AI 音乐',
    subtitle: '频谱创作 · 音符粒子',
    description: 'AI 辅助作曲、编曲、歌词生成。动态频谱可视化，音符粒子交互创作体验。',
    manifesto: '万物皆有其律',
    icon: '🎵',
    route: '/workspace/music',
    color: '#F472B6',
    enabled: true,
    status: 'stable',
    order: 4,
  },
  {
    id: 'ad',
    realm: '商界',
    title: 'AI 广告视频',
    subtitle: '爆款拆解 · 素材重组',
    description: 'AI 分析爆款广告结构，自动重组素材、生成广告脚本、合成视频。转化率驱动的智能创作。',
    manifesto: '流量之道，尽在镜中',
    icon: '📊',
    route: '/studio/v2',
    color: '#34D399',
    enabled: true,
    status: 'stable',
    order: 5,
  },
]

/**
 * 获取首页可见的 Realm 列表（按 order 排序）
 * 只展示 stable / beta / preview，过滤 hidden / deprecated
 *
 * 替代旧的 getEnabledRealms()，统一使用 status 字段
 */
export function getEnabledRealms(): RealmDefinition[] {
  return REALMS
    .filter(r => r.status !== 'hidden' && r.status !== 'deprecated')
    .sort((a, b) => a.order - b.order)
}

/**
 * 获取 Realm 状态提示文案
 */
export function getRealmStatusNotice(status: RealmStatus): string | null {
  const map: Record<RealmStatus, string | null> = {
    stable: null,
    beta: '公测版，功能完整但可能存在 bug。',
    preview: '预览版，部分功能未开放。',
    hidden: '该工作台暂未开放。',
    deprecated: '该工作台即将下线，仅保留历史数据查询。',
  }
  return map[status]
}

/**
 * 按 id 查找 Realm
 */
export function getRealmById(id: string): RealmDefinition | undefined {
  return REALMS.find(r => r.id === id)
}

/**
 * 获取所有境界名列表
 */
export function getRealmNames(): string[] {
  return REALMS.map(r => r.realm)
}
