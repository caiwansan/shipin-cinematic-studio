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
export type ShotType = 'establishing' | 'reveal' | 'dialogue' | 'confrontation' | 'action' | 'impact' | 'climax' | 'transition' | 'reaction' | 'detail' | 'ending';
export type ShotMood = 'epic' | 'tense' | 'mysterious' | 'solemn' | 'violent' | 'tragic' | 'joyful' | 'peaceful' | 'chaotic' | 'dreamy' | 'horror' | 'awe';
export interface ShotNode {
    /** 镜头编号（如 "001", "002"） */
    id: string;
    /** 导演语义分类 */
    shotType: ShotType;
    /** 一句话描述（导演角度） */
    description: string;
    /** 画面内容简述（给 viewer 看） */
    visual: string;
    /** 主体角色 */
    subject: string[];
    /** 环境/场景 */
    environment: string;
    /** 核心叙事动作 */
    action: string;
    /** 情绪基调 */
    mood: ShotMood;
    /** 预估时长（秒） */
    duration: number;
    /** 转场至下一镜的方式 */
    transition?: string;
}
export interface ShotGraph {
    /** 场景名称 */
    title: string;
    /** 场景一句话概要 */
    synopsis?: string;
    /** 镜头列表（有序） */
    shots: ShotNode[];
    /** 总时长估（秒） */
    totalDuration: number;
    /** 能量弧描述 */
    energyArc: string;
}
/**
 * 根据场景描述自动推断场景类型
 */
export type SceneType = 'battle' | 'dialogue' | 'chase' | 'exploration' | 'ceremony' | 'disaster' | 'romance' | 'travel' | 'suspense' | 'tranformation';
/**
 * 场景类型 → 默认镜头模板
 */
export declare const SHOT_PATTERNS: Record<SceneType, ShotType[]>;
/**
 * 基于关键词推断场景类型
 */
export declare function inferSceneType(text: string): SceneType;
