// ═══════════════════════════════════════════════════════════════
// CinematicIR — 电影中间表示（Temporal Cinematic Runtime 核心）
// ═══════════════════════════════════════════════════════════════
// 这是整个导演语言的 Stable Intermediate Representation。
// 所有上层（Narrative → Action Intent → Cinematic IR）的编译结果，
// 所有下层（Cinematic IR → Model-specific Prompt → WAN/Veo/Kling）的输入。
// ═══════════════════════════════════════════════════════════════

// ─── 元数据 ─────────────────────────────────────────

export interface CINMetadata {
  version: 'v1'
  createdAt: number
  source: 'agent' | 'manual' | 'imported'
  projectId: string
  segmentId: string
}

// ─── 强度等级 ───────────────────────────────────────

export type IntensityLevel =
  | 'light'        // 小幅试探动作
  | 'medium'       // 常规攻防
  | 'aggressive'   // 爆发性攻击，幅度大
  | 'explosive'    // 极限爆发，冲击波+慢镜头

// ─── 物理修饰 ───────────────────────────────────────

export type PhysicsModifier =
  | 'heavy_impact'   // 落地/击打有重量感，地面震动
  | 'floaty'         // 漂浮感（轻功/腾空）
  | 'weightless'     // 失重效果，非人类速度
  | 'snappy'         // 动作干脆利落
  | 'high_inertia'   // 惯性大，动作带弧度延续
  | 'rigid'          // 僵硬，防御姿态

// ─── 镜头系统 ───────────────────────────────────────

export type ShotType =
  | 'low_angle'
  | 'top_down'
  | 'bird_eye'
  | 'orbit'
  | 'tracking_left'
  | 'tracking_right'
  | 'close_up'
  | 'extreme_close_up'
  | 'over_shoulder'
  | 'follow_cam'
  | 'handheld'
  | 'zoom_in'
  | 'push_in'
  | 'pull_out'
  | 'wide'
  | 'heroic_angle'

export type CameraMovement =
  | 'static'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'dolly_in'
  | 'dolly_out'
  | 'crane_up'
  | 'crane_down'
  | 'steadycam'
  | 'whip_pan'

export type FramingType =
  | 'extreme_wide'
  | 'wide'
  | 'full'
  | 'medium'
  | 'medium_close'
  | 'close_up'
  | 'extreme_close_up'

export type LensType =
  | 'wide_24mm'
  | 'standard_50mm'
  | 'portrait_85mm'
  | 'tele_135mm'
  | 'anamorphic'
  | 'fisheye'

export interface CameraBinding {
  shotType: ShotType
  movement: CameraMovement
  framing: FramingType
  lens?: LensType
  shake?: number           // 0-10，手持抖动强度
  speed?: number           // 0.1-3.0，镜头运动速度倍率
  actorFocus?: string      // 聚焦的角色名
}

// ─── 动作动词 ───────────────────────────────────────

export type ActionVerb =
  | 'rush' | 'charge' | 'lunge'
  | 'leap' | 'jump' | 'vault' | 'somersault' | 'flip'
  | 'swing' | 'slash' | 'strike' | 'smash' | 'punch' | 'kick'
  | 'block' | 'parry' | 'deflect'
  | 'dodge' | 'sidestep' | 'duck' | 'roll'
  | 'spin' | 'twirl' | 'whirl' | 'pivot'
  | 'soar' | 'hover' | 'airborne'
  | 'land' | 'stomp' | 'crash'
  | 'chase' | 'pursue'
  | 'knockback' | 'stagger'
  | 'grab' | 'seize' | 'tackle'
  | 'throw' | 'slam'

// ─── 过渡弧（Temporal Continuity Engine 核心）─────

export type TransitionType =
  | 'smooth'            // 自然过渡，速度矢量继承
  | 'hard_cut'          // 镜头切换，动作断开
  | 'momentum_carry'    // 惯性延续，收招带余势
  | 'anticipation'      // 蓄力预备，动作前摇
  | 'snap'              // 快速切换，无过渡
  | 'impact_freeze'     // 击打瞬间冻结 1-2 帧
  | 'sudden_stop'       // 急停定格

export interface TransitionArc {
  type: TransitionType
  fromActionId: string
  toActionId: string
  blendFrames?: number         // 混合帧数（平滑过渡用）
  preserveVelocity?: boolean    // 是否继承速度矢量
  preserveDirection?: boolean   // 是否保持运动方向
  overlapSeconds?: number       // 交叠时长（0 = hard cut）
}

// ─── 特效绑定 ──────────────────────────────────────

export type VFXEffect =
  | 'sparks'
  | 'embers'
  | 'glow'
  | 'shimmer'
  | 'radiance'
  | 'light_rays'
  | 'shockwave'
  | 'impact_ring'
  | 'blast'
  | 'energy_trail'
  | 'light_streak'
  | 'smoke'
  | 'dust_cloud'
  | 'mist'
  | 'water_splash'
  | 'foam'
  | 'spray'
  | 'motion_blur'
  | 'afterimage'
  | 'debris'

export interface VFXBinding {
  effect: VFXEffect
  startTime: number        // 相对片段起始的秒
  duration: number         // 持续秒数
  attachedToActionId?: string  // 关联的动作节点 ID
  intensity?: number       // 0-10，特效强度
}

// ─── 表情状态 ──────────────────────────────────────

export interface EmotionState {
  actorId: string
  expression: string       // 自由文本，如"focused""rage""shocked"
  intensity: number        // 0-10
  timing: number           // 在片段中的时间点（秒）
  transition: 'instant' | 'gradual' | 'reaction'
}

// ─── 动作节点（Runtime 原子单元）─────────────────

export interface ActionNode {
  id: string
  actorId: string
  action: ActionVerb
  intensity: IntensityLevel
  physics: PhysicsModifier[]
  duration: number          // 该动作的时长（秒）
  startTime: number         // 在片段中的起始时间（秒）
  emotion?: EmotionState
  vfx?: VFXBinding[]
}

// ─── 环境层（预留）─────────────────────────────────

export interface EnvironmentTrack {
  // 未来：lighting, weather, timeOfDay, environment effects
}

// ─── 音频层（预留）─────────────────────────────────

export interface AudioTrack {
  // 未来：bgm intensity, sfx timing, rhythm markers
}

// ─── 语义节奏块 ────────────────────────────────────

export interface TimelineBeat {
  start: number             // 此 beat 起始时间
  end: number               // 此 beat 结束时间
  activeActions: ActionNode[]
  dominantCamera?: CameraBinding
  emotionalState?: string   // 此 beat 主导情绪
  energyLevel?: number      // 0-10，能量感知等级
  vfxActive?: VFXEffect[]  // 当前活跃特效
  description?: string      // 人类可读标注
}

// ─── CinematicIR —— 顶层结构 ──────────────────────

export interface CinematicSequence {
  metadata: CINMetadata
  // 时间轴
  totalDuration: number     // 总时长（秒）
  beats: TimelineBeat[]     // 语义节奏块（替代 raw frames）
  // 动作图
  actions: ActionNode[]
  // 各轨道
  cameraTrack: CameraBinding[]
  // 过渡弧（Temporal Continuity Engine）
  transitions: TransitionArc[]
  // 其它轨道（预留）
  environmentTrack?: EnvironmentTrack
  audioTrack?: AudioTrack
  // 全局修饰
  pace: 'fast' | 'normal' | 'slow'
  vibe: 'epic' | 'tense' | 'playful' | 'dramatic' | 'mysterious'
  // 编译结果缓存
  compiledPrompt?: string   // 最终生成模型用的 narrativePurpose
}

// ─── 助手函数 ──────────────────────────────────────

export function createCinematicSequence(meta: Partial<CINMetadata>): CinematicSequence {
  return {
    metadata: {
      version: 'v1',
      createdAt: Date.now(),
      source: 'agent',
      projectId: meta.projectId || '',
      segmentId: meta.segmentId || '',
    },
    totalDuration: 0,
    beats: [],
    actions: [],
    cameraTrack: [],
    transitions: [],
    pace: 'normal',
    vibe: 'epic',
  }
}
