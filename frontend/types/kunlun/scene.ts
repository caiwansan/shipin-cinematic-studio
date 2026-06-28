/**
 * 昆仑镜 — Scene 类型系统
 *
 * 定义首页所有场景的数据结构
 * 每个 Scene 独立运行，由 pages/index.vue 编排
 */

import type { RealmDefinition } from '~/utils/kunlun/realms'

// ──────────────────────────────────────────
// Scene 元数据
// ──────────────────────────────────────────

export interface SceneMeta {
  /** 唯一标识 */
  id: string
  /** 场景名称 */
  name: string
  /** 所属境界（非五境场景此字段为空） */
  realm?: string
  /** 使用的组件列表 */
  components: string[]
  /** 入场动画方案 */
  animation: 'reveal-bottom' | 'reveal-scale' | 'fade-in' | 'prism-enter' | 'mirror-appear' | 'none'
  /** 场景间过渡 */
  transition: 'fade' | 'slide-up' | 'refraction' | 'prism-cross' | 'none'
}

// ──────────────────────────────────────────
// HeroScene
// ──────────────────────────────────────────

export interface HeroSceneData {
  headline: string
  subline: string
  primaryCTA: { text: string; route: string }
  secondaryCTA: { text: string; route?: string }
  marqueeItems: string[]
}

// ──────────────────────────────────────────
// ChoiceLiberationScene
// ──────────────────────────────────────────

export interface PainPoint {
  label: string
  icon: string
}

export interface FreedomPoint {
  label: string
  icon: string
}

export interface ChoiceLiberationSceneData {
  title: string
  subtitle?: string
  pain: {
    label: string
    points: PainPoint[]
  }
  freedom: {
    label: string
    points: FreedomPoint[]
  }
}

// ──────────────────────────────────────────
// WorkbenchUniverseScene
// ──────────────────────────────────────────

export interface WorkbenchUniverseSceneData {
  title: string
  subtitle?: string
  realms: RealmDefinition[]
  layout: 'bento' | 'grid' | 'carousel'
}

// ──────────────────────────────────────────
// WenquxingScene
// ──────────────────────────────────────────

export interface WenquxingSceneData {
  title: string
  subtitle?: string
  countTarget: number
  countLabel: string
  demoSteps: string[]
}

// ──────────────────────────────────────────
// CreationLawScene
// ──────────────────────────────────────────

export interface CreationLaw {
  index: number
  title: string
  description: string
  icon: string
}

export interface CreationLawSceneData {
  title: string
  subtitle?: string
  laws: CreationLaw[]
}

// ──────────────────────────────────────────
// FourStepScene
// ──────────────────────────────────────────

export interface Step {
  index: number
  title: string
  description: string
  icon: string
}

export interface FourStepSceneData {
  title: string
  subtitle?: string
  steps: Step[]
}

// ──────────────────────────────────────────
// CreatorVoicesScene
// ──────────────────────────────────────────

export interface CreatorVoice {
  avatar: string
  name: string
  title: string
  content: string
  rating: number
}

export interface CreatorVoicesSceneData {
  title: string
  subtitle?: string
  voices: CreatorVoice[]
}

// ──────────────────────────────────────────
// FinalCTAScene
// ──────────────────────────────────────────

export interface FinalCTASceneData {
  headline: string
  subheadline: string
  ctaText: string
  ctaRoute: string
}

// ──────────────────────────────────────────
// 首页完整数据结构
// ──────────────────────────────────────────

export interface HomepageData {
  hero: HeroSceneData
  choice: ChoiceLiberationSceneData
  workbench: WorkbenchUniverseSceneData
  wenquxing: WenquxingSceneData
  laws: CreationLawSceneData
  steps: FourStepSceneData
  voices: CreatorVoicesSceneData
  final: FinalCTASceneData
}

// ──────────────────────────────────────────
// 场景注册表
// ──────────────────────────────────────────

import { getEnabledRealms } from '~/utils/kunlun/realms'

/**
 * 首页场景默认数据
 * 各 Scene 组件从此获取默认文案
 * 未来可从 CMS/API 动态覆盖
 */
export const DEFAULT_HOMEPAGE_DATA: HomepageData = {
  hero: {
    headline: '万物皆备于我\n一镜照见乾坤',
    subline: '全栈式 SaaS AI 创作平台 · 自持密钥 · 直连大模型 · 永不排队',
    primaryCTA: { text: '免费注册', route: '/?showLogin=1&register=1' },
    secondaryCTA: { text: '在线体验', route: '/studio/v2' },
    marqueeItems: [
      'GPT-5', 'Claude', 'Gemini', 'Sora',
      'Midjourney', 'Flux', 'Suno', 'Runway',
    ],
  },
  choice: {
    title: '还在为算力焦虑买单？',
    pain: {
      label: '旧世界',
      points: [
        { label: '排队等待', icon: '⏳' },
        { label: '模型降级', icon: '⬇️' },
        { label: 'Token 加价', icon: '💰' },
        { label: '抽卡质量', icon: '🎲' },
      ],
    },
    freedom: {
      label: '昆仑镜',
      points: [
        { label: '钥匙在手', icon: '🔑' },
        { label: '原厂质量', icon: '✨' },
        { label: '零抽成', icon: '🆓' },
        { label: '极速响应', icon: '⚡' },
      ],
    },
  },
  workbench: {
    title: '驾驭五大创作领域',
    subtitle: '一人即是一个团队',
    realms: getEnabledRealms(),
    layout: 'bento',
  },
  wenquxing: {
    title: '不仅是长，更是过目不忘的文曲星',
    subtitle: 'AI 长期记忆可视化',
    countTarget: 10000000,
    countLabel: '字记忆容量',
    demoSteps: ['第 50 章', '瞬间召回', '第 1 章伏笔'],
  },
  laws: {
    title: '昆仑镜三大创作铁律',
    laws: [
      {
        index: 1,
        title: '拒绝一眼 AI',
        description: '85 分强制过稿，确保每帧画面都在标准线之上',
        icon: '🎯',
      },
      {
        index: 2,
        title: '拒绝角色漂移',
        description: '三视图角色锚定 + 首尾帧约束，角色从头到尾一致',
        icon: '🎭',
      },
      {
        index: 3,
        title: '拒绝复杂操作',
        description: '浏览器即开即用，无需安装任何专业软件',
        icon: '🖥️',
      },
    ],
  },
  steps: {
    title: '四步照鉴万物',
    steps: [
      { index: 1, title: '注册账号', description: '60 秒完成注册', icon: '📝' },
      { index: 2, title: '获取 API Key', description: '从模型厂商获取密钥', icon: '🔑' },
      { index: 3, title: '粘贴连接', description: '在设置中粘贴你的密钥', icon: '🔗' },
      { index: 4, title: '开始创作', description: '开启你的 AI 创作之旅', icon: '🚀' },
    ],
  },
  voices: {
    title: '创作者说',
    voices: [
      {
        avatar: '🎬',
        name: '独立创作者',
        title: '短剧创作者',
        content: '从写剧本到出片，一个人就能完成过去整个剧组的活。',
        rating: 5,
      },
      {
        avatar: '📚',
        name: '网络作家',
        title: '小说创作者',
        content: '百万字的长篇终于有人帮我记住所有人物关系了。',
        rating: 5,
      },
      {
        avatar: '🎯',
        name: '营销总监',
        title: '企业用户',
        content: '演示文稿自动生成配图排版，提案效率翻了三倍。',
        rating: 5,
      },
    ],
  },
  final: {
    headline: '此时此刻，照见你的想象力',
    subheadline: '开启昆仑镜，立享全球顶级 AI 算力，永不排队',
    ctaText: '开始免费创作',
    ctaRoute: '/?showLogin=1&register=1',
  },
}
