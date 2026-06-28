/**
 * Narrative Audio Runtime — Role Voice Runtime（预留）
 * 
 * 未来支持多角色配音：
 * - 男主
 * - 女主
 * - 反派
 * - 旁白
 * 
 * 每个角色绑定一个 Voice + Emotion
 * 当前为接口定义，暂不实现业务逻辑
 */
export type SpeakerRole = 'narrator' | 'male_lead' | 'female_lead' | 'villain' | 'supporting'

export interface RoleVoiceConfig {
  speaker: SpeakerRole
  /** kokoro_male_01 / pip_female_02 / espeak_narrator 等 */
  voice: string
  /** 默认情绪 */
  defaultEmotion: Emotion
}

export type Emotion = 'calm' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'neutral'

/**
 * 角色 → 音色映射表（预留）
 * key: speaker, value: VoiceProvider 的 voiceId
 */
export type RoleVoiceMap = Partial<Record<SpeakerRole, string>>
