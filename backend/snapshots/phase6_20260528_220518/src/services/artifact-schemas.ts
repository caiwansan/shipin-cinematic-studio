/**
 * artifact-schemas.ts — Artifact Layer v1 结构契约定义
 *
 * 每个 Artifact 代表一个 stage 的结构化输出产物。
 * - typed strict（禁止 any/free-form）
 * - versioned（可演化）
 * - owned by stage（谁生成谁负责）
 * - persistent（DB 独立表 = truth）
 */

// ==================== 基础类型 ====================

export enum ArtifactStatus {
  CREATED = 'created',       // 占位，未生成
  GENERATED = 'generated',   // AI 已输出
  PERSISTED = 'persisted',   // 已写入 DB
  FAILED = 'failed',         // 生成失败
}

export interface ArtifactBase {
  id: string
  projectId: string
  version: number
  status: ArtifactStatus
  source: 'agent' | 'manual' | 'fallback' | 'legacy'
  createdAt: string  // ISO
  updatedAt: string  // ISO
}

// ==================== Scene Artifact ====================

export interface SceneItem {
  sceneId: string
  sceneName: string
  description: string          // 50+ 字场景描述
  imagePrompt: string          // 100+ 字绘图提示词
  negativePrompt?: string
  aspectRatio: string          // 16:9 / 9:16 / 1:1
  env?: string                 // 室内/室外/幻境
  time?: string                // 白天/夜晚/黄昏
  mood?: string                // 氛围
}

export interface SceneArtifact extends ArtifactBase {
  type: 'scene'
  sceneList: SceneItem[]
  /** 元数据：AI 原始输出快照，仅用于回滚/审计 */
  metadata?: Record<string, unknown>
}

// ==================== Voice Artifact ====================

export interface VoiceConfigItem {
  characterName: string
  voiceType: string            // 音色引擎
  speakingStyle: string
  pitch: number
  speed: number
  ttsPrompt: string            // TTS 完整提示词
  audioUrl?: string            // 生成后的音频 URL
}

export interface VoiceArtifact extends ArtifactBase {
  type: 'voice'
  voiceConfigs: VoiceConfigItem[]
  metadata?: Record<string, unknown>
}

// ==================== Frame Artifact ====================

export interface FrameItem {
  segmentId: string
  firstFrame: {
    description: string
    imagePrompt: string
    cameraAngle?: string
    imageUrl?: string
  }
  lastFrame: {
    description: string
    imagePrompt: string
    cameraAngle?: string
    imageUrl?: string
  }
}

export interface FrameArtifact extends ArtifactBase {
  type: 'frame'
  frames: FrameItem[]
  metadata?: Record<string, unknown>
}

// ==================== Video Artifact ====================

export interface VideoSegmentItem {
  segmentId: string
  title: string
  associatedScenes: string[]   // sceneId 列表
  duration: number             // 秒
  narrativePurpose: string
  shotPattern: string
  emotionArc: string
  backgroundMusic: string
  videoUrl?: string
  optimizedPrompt?: string
}

export interface VideoArtifact extends ArtifactBase {
  type: 'video'
  timeline: VideoSegmentItem[]
  metadata: {
    overallStyle?: string
    fps?: number
    resolution?: string
    colorPalette?: string
    transitionStyle?: string
    cameraMovement?: string
    lighting?: string
  }
}

// ==================== Union Type ====================

export type StageArtifact = SceneArtifact | VoiceArtifact | FrameArtifact | VideoArtifact

// ==================== AI Output Contract ====================
// Agent 的输出必须符合这些契约，否则 rejection + retry

export interface SceneAgentOutput {
  scenes: Array<{
    sceneId: string
    sceneName: string
    description: string
    imagePrompt: string
    negativePrompt?: string
    aspectRatio: string
    env?: string
    time?: string
    mood?: string
  }>
}

export interface VoiceAgentOutput {
  voiceConfigs: Array<{
    characterName: string
    voiceType: string
    speakingStyle: string
    pitch: number
    speed: number
    ttsPrompt: string
  }>
}

export interface FrameAgentOutput {
  frames: Array<{
    segmentId: string
    firstFrame: {
      description: string
      imagePrompt: string
      cameraAngle?: string
    }
    lastFrame: {
      description: string
      imagePrompt: string
      cameraAngle?: string
    }
  }>
}

export interface VideoAgentOutput {
  timeline: Array<{
    segmentId: string
    title: string
    associatedScenes: string[]
    duration: number
    narrativePurpose: string
    shotPattern: string
    emotionArc: string
    backgroundMusic: string
  }>
  metadata: {
    overallStyle?: string
    fps?: number
    resolution?: string
    colorPalette?: string
    transitionStyle?: string
  }
}

// ==================== VideoProduction Contract (v3) ====================
// DirectorEngine 的输出 — deterministic planner，非 AI Agent

export interface ShotGraphOutput {
  shotGraph: {
    shots: Array<{
      shotId: string
      sceneId: string
      type: string
      purpose: string
      duration: number
      intensity: number
    }>
    transitions: Array<{
      fromShotId: string
      toShotId: string
      type: string
    }>
  }
  pacing: {
    curve: number[]
    peakPoints: number[]
    totalDuration: number
  }
  renderStrategy: string
}

// ==================== Final Video Production Artifact ====================

export interface VideoProductionArtifact extends ArtifactBase {
  type: 'video_production'
  version: string
  shotGraph: {
    scenes: Array<{
      sceneId: string
      sceneName: string
      duration: number
      shots: Array<{
        shotId: string
        type: string
        purpose: string
        duration: number
        intensity: number
      }>
    }>
    transitions: Array<{
      fromShotId: string
      toShotId: string
      type: string
    }>
  }
  pacing: {
    curve: number[]
    peakPoints: number[]
    totalDuration: number
  }
  renderStrategy: string
  cinematicRendered: boolean   // 是否已由 cinematic-shot.agent 填充视觉细节
}
