/**
 * shared/runtime/shot-graph.ts — Canonical Shot Graph Schema
 *
 * Sprint 1: 纯导演语义，不含 Camera/VFX/Particle/Motion
 *
 * 宪法规定：
 *   - ShotGraph 是昆仑镜所有视频生成的唯一事实源
 *   - 禁止 Prompt → Video 直通，必须经过 ShotGraph
 *   - ShotNode 只定义导演决策，不定义镜头运动/特效/渲染参数
 */

// ============================================================
// Shot Types — 导演语义
// ============================================================

export type ShotType =
  | 'establishing'      // 定场：交代环境/氛围
  | 'reveal'            // 亮相：角色/物体首次出现
  | 'dialogue'          // 对话：角色间交流
  | 'confrontation'     // 对峙：双方/多方紧张对峙
  | 'action'            // 动作：追逐/移动/战斗过程
  | 'impact'            // 冲击：碰撞/爆炸/关键事件
  | 'climax'            // 高潮：全片段最高能量点
  | 'transition'        // 转场：时空跳跃/场景变换
  | 'reaction'          // 反应：角色对事件的情绪反应
  | 'detail'            // 特写：关键道具/细节/符号
  | 'ending'            // 结尾：收束/余韵/黑屏

// ============================================================
// Emotion/Energy Tags
// ============================================================

export type ShotMood =
  | 'epic'              // 史诗
  | 'tense'             // 紧张
  | 'mysterious'        // 神秘
  | 'solemn'            // 肃穆
  | 'violent'           // 暴烈
  | 'tragic'            // 悲壮
  | 'joyful'            // 欢快
  | 'peaceful'          // 宁静
  | 'chaotic'           // 混乱
  | 'dreamy'            // 梦幻
  | 'horror'            // 恐怖
  | 'awe'               // 敬畏

// ============================================================
// Shot Node
// ============================================================

export interface ShotNode {
  /** 镜头编号（如 "001", "002"） */
  id: string

  /** 导演语义分类 */
  shotType: ShotType

  /** 一句话描述（导演角度） */
  description: string

  /** 画面内容简述（给 viewer 看） */
  visual: string

  /** 主体角色 */
  subject: string[]

  /** 环境/场景 */
  environment: string

  /** 核心叙事动作 */
  action: string

  /** 情绪基调 */
  mood: ShotMood

  /** 预估时长（秒） */
  duration: number

  /** 转场至下一镜的方式 */
  transition?: string
}

// ============================================================
// Shot Graph — 整个场景/片段的镜头计划
// ============================================================

export interface ShotGraph {
  /** 场景名称 */
  title: string

  /** 场景一句话概要 */
  synopsis?: string

  /** 镜头列表（有序） */
  shots: ShotNode[]

  /** 总时长估（秒） */
  totalDuration: number

  /** 能量弧描述 */
  energyArc: string
}

// ============================================================
// Shot Plan Rules — 场景类型 → 镜头序列模板
// ============================================================

/**
 * 根据场景描述自动推断场景类型
 */
export type SceneType =
  | 'battle'          // 战斗
  | 'dialogue'        // 对话
  | 'chase'           // 追逐
  | 'exploration'     // 探索
  | 'ceremony'        // 仪式
  | 'disaster'        // 灾难
  | 'romance'         // 情感
  | 'travel'          // 旅程
  | 'suspense'        // 悬疑
  | 'tranformation'   // 蜕变

/**
 * 场景类型 → 默认镜头模板
 */
export const SHOT_PATTERNS: Record<SceneType, ShotType[]> = {
  battle:        ['establishing', 'reveal', 'reveal', 'confrontation', 'action', 'action', 'impact', 'climax', 'reaction', 'ending'],
  dialogue:      ['establishing', 'dialogue', 'dialogue', 'dialogue', 'ending'],
  chase:         ['establishing', 'action', 'action', 'action', 'impact', 'ending'],
  exploration:   ['establishing', 'reveal', 'detail', 'action', 'reveal', 'ending'],
  ceremony:      ['establishing', 'reveal', 'dialogue', 'climax', 'reaction', 'ending'],
  disaster:      ['establishing', 'action', 'action', 'impact', 'climax', 'reaction', 'ending'],
  romance:       ['establishing', 'reveal', 'dialogue', 'dialogue', 'climax', 'ending'],
  travel:        ['establishing', 'action', 'reveal', 'action', 'reveal', 'ending'],
  suspense:      ['establishing', 'detail', 'detail', 'confrontation', 'climax', 'reaction', 'ending'],
  tranformation: ['establishing', 'reveal', 'action', 'climax', 'reveal', 'ending'],
}

/**
 * 基于关键词推断场景类型
 */
export function inferSceneType(text: string): SceneType {
  const t = text.toLowerCase()

  const battleKeywords = ['大战', '战斗', '对决', '对战', '厮杀', '交锋', '搏斗', 'fight', 'battle', 'war', 'combat', 'clash']
  if (battleKeywords.some(k => t.includes(k))) return 'battle'

  const chaseKeywords = ['追逐', '追赶', '追击', '逃跑', 'chase', 'run', 'escape', 'pursuit']
  if (chaseKeywords.some(k => t.includes(k))) return 'chase'

  const disasterKeywords = ['灾难', '毁灭', '崩塌', '爆炸', 'disaster', 'destroy', 'explosion', 'collapse']
  if (disasterKeywords.some(k => t.includes(k))) return 'disaster'

  const suspicionKeywords = ['悬疑', '秘密', '黑暗', '诡异', 'suspense', 'mystery', 'secret', 'dark']
  if (suspicionKeywords.some(k => t.includes(k))) return 'suspense'

  const romanceKeywords = ['爱情', '相遇', '表白', 'love', 'romance', 'kiss', 'meet']
  if (romanceKeywords.some(k => t.includes(k))) return 'romance'

  const ceremonyKeywords = ['仪式', '祭典', '加冕', 'ceremony', 'ritual', 'coronation']
  if (ceremonyKeywords.some(k => t.includes(k))) return 'ceremony'

  const transformationKeywords = ['蜕变', '觉醒', '突破', '升级', 'awaken', 'transform', 'evolve']
  if (transformationKeywords.some(k => t.includes(k))) return 'tranformation'

  const travelKeywords = ['旅程', '飞行', '穿越', 'travel', 'journey', 'fly', 'cross']
  if (travelKeywords.some(k => t.includes(k))) return 'travel'

  const explorationKeywords = ['探索', '发现', '进入', 'explore', 'discover', 'enter']
  if (explorationKeywords.some(k => t.includes(k))) return 'exploration'

  return 'dialogue'
}
