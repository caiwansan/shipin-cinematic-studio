/**
 * Speech Act Marker Layer (SAM) — 0号层
 *
 * 在 BCSG 之前执行的 tag-only annotator。
 * 只做一件事：标记"这是在说话"。
 *
 * 圣裁约束（不可违反）：
 *   ❌ 不得触发 shot split
 *   ❌ 不得改变 boundary detection
 *   ❌ 不得影响 priority system
 *   ❌ 不得扩展 emotion inference / intent detection / discourse modeling
 *   ❌ 不得进入"结构决策域"
 *
 *   ✔ 只做：label clause as speech_act + 附加 metadata
 *   ✔ 本质：lexical event annotator — "这句是说话"，仅此而已
 *   ✔ 必须保持 regex-level deterministic
 */

export type SpeechActType = 'dialogue' | 'monologue' | 'voiceover'

export type DialoguePolarity = 'question' | 'answer' | 'assertion' | 'unknown'

export interface SpeechActMark {
  type: 'speech_act'
  speechType: SpeechActType
  speaker: string | null
  polarity: DialoguePolarity
  tone: 'neutral' | 'intense' | 'quiet'
  /** 原始文本 */
  rawText: string
}

/**
 * 检测一段 clause 是否为 speech act。
 *
 * 检测规则（regex-level only）：
 *   - 中文引号：｢「」｣、『』、“”
 *   - 英文引号：""、''
 *   - 说话动词：说、道、问、答、喊、叫、喊叫、解释、回答
 *   - 冒号语气：xxx：[内容]
 *   - 不依赖 NLP / emotion / intent
 */
export function isSpeechAct(clause: string): boolean {
  // 引号检测（成对中文/英文引号）
  if (
    /[「『""]/.test(clause) && /[」』""]/.test(clause)
  ) {
    return true
  }

  // 中文引号候选（左引号）
  if (/[「『""]/.test(clause)) {
    return true
  }

  // 说话动词检测（"道"必须作为 suffix 跟在人称后，排除"街道/通道/道路"）
  if (
    /[：:]\s*[""「『]/.test(clause) ||
    /(说|问|答|喊|叫|喊叫|解释|回答|告诉|询问|回应|吼道|哭道|笑道|叹道|怒道|低声道|轻声说|大声说|喃喃|自语|问道|答道)/.test(clause) ||
    /[他她它你我]道/.test(clause)
  ) {
    return true
  }

  // 冒号结构：xxx：yyyy（对话场景常见，但排除场景描述型）
  // 场景描述型标记词：夜景、外景、内景、场景、清晨、午后、傍晚
  if (/^[^。！？，、；：]{1,12}[:：].{3,}$/.test(clause)) {
    // 排除常见场景/时间描述
    if (!/^(夜景|外景|内景|场景|清晨|午后|傍晚|深夜|日景|室内|室外)/.test(clause)) {
      return true
    }
  }

  return false
}

/**
 * 从 clause 中提取 speaker（如果有）
 */
export function extractSpeaker(clause: string): string | null {
  // 匹配 "XXX说：", "XXX道" — speaker 后紧跟说话动词
  // 排除常见的非说话场景："他看着她说" → speaker 应该是"他"而不是"他看着她"
  const speakerMatch = clause.match(
    /^([^，。！？：:""「」『』\s.!?]{1,4})(?:说|道|问|答|喊|叫|吼道|哭道|笑道|叹道|怒道|低声道|轻声说|大声说)(?=[：:""「])/
  )
  if (speakerMatch) {
    const name = speakerMatch[1].trim()
    // 过滤明显不是人名的模式
    if (name.length <= 4 && !/着|了|过|在|把|被|使|让|将/.test(name)) {
      return name
    }
  }
  return null
}

/**
 * 判断对话极性
 */
export function detectPolarity(clause: string): DialoguePolarity {
  if (/[？?]/.test(clause)) return 'question'
  if (/(是|对|好|嗯|行|可以|知道|明白|来了)/.test(clause) && clause.length < 20) return 'answer'
  return 'assertion'
}

/**
 * 判断语气强度
 */
export function detectTone(clause: string): SpeechActMark['tone'] {
  if (/(！|!|吼|喊|怒|骂|尖叫|吓|命令|闭嘴|滚)/.test(clause)) return 'intense'
  if (/(轻声|低声道|悄悄|小声|喃喃|细语|whisper)/.test(clause)) return 'quiet'
  return 'neutral'
}

/**
 * 完整的 speech act 标记函数（SAM 核心接口）
 *
 * 输入：一条 clause（自然语言描述的一句话）
 * 输出：如果是 speech act，返回 SpeechActMark；否则返回 null
 */
export function markSpeechAct(clause: string): SpeechActMark | null {
  if (!isSpeechAct(clause)) return null

  const speaker = extractSpeaker(clause)
  const speechType: SpeechActType = clause.includes('独白') || clause.includes('旁白') || clause.includes('内心')
    ? 'monologue'
    : 'dialogue'

  return {
    type: 'speech_act',
    speechType,
    speaker,
    polarity: detectPolarity(clause),
    tone: detectTone(clause),
    rawText: clause.slice(0, 120),
  }
}
