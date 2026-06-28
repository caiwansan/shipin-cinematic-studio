/**
 * Intent Classifier v3 — 意图类型识别
 *
 * 判断输入属于哪种类型，以及语义密度。
 * 纯规则引擎，不调 LLM。
 */

export type IntentType = 'concept' | 'story_seed' | 'full_story' | 'scene_request' | 'emotion_seed'

export interface IntentClassification {
  intentType: IntentType
  confidence: number     // 0-1
  detectedEntities: string[]
  semanticDensity: number // 0-1: 内容信息量密度
}

// 中文关键词检测模式
const PATTERNS: Record<string, RegExp[]> = {
  full_story: [
    /第[一二三四五六七八九十\d]+[章节集话]/,
    /剧本/,
    /[角色人物].*[对话台词]/,
    /场景\s*\d+/,
  ],
  scene_request: [
    /场景/,
    /写.*[场画面]/,
    /[场画面].*写/,
    /拍.*[场画面]/,
    /[场画面].*拍/,
    /描述.*[场画面]/,
  ],
  story_seed: [
    /故事/,
    /关于.*的/,
    /主角/,
    /讲[述说].*[故事剧情]/,
  ],
  emotion_seed: [
    /情绪|情感|氛围|气氛|基调/,
    /悲伤|喜悦|愤怒|感动|温暖|压抑/,
  ],
  concept: [
    /^.{1,20}$/,          // 非常短的内容 → concept
    /^[^，。！？\n]{1,15}$/, // 无标点短句
  ],
}

export class IntentClassifier {
  classify(input: string): IntentClassification {
    const detectedEntities: string[] = []

    // 按优先级从高到低匹配
    const checkType = (type: IntentType): boolean => {
      const patterns = PATTERNS[type]
      if (!patterns) return false
      return patterns.some(p => {
        const match = input.match(p)
        if (match) {
          detectedEntities.push(match[0])
          return true
        }
        return false
      })
    }

    // 检测顺序：具体 → 抽象
    let intentType: IntentType = 'concept'
    if (checkType('full_story')) intentType = 'full_story'
    else if (checkType('scene_request')) intentType = 'scene_request'
    else if (checkType('story_seed')) intentType = 'story_seed'
    else if (checkType('emotion_seed')) intentType = 'emotion_seed'
    else if (checkType('concept')) intentType = 'concept'

    // 语义密度：基于长度和实体数量的简单估算
    const entityDensity = detectedEntities.length > 0 ? Math.min(detectedEntities.length / 3, 0.5) : 0
    const lengthDensity = Math.min(input.length / 200, 0.5)
    const semanticDensity = Math.round((entityDensity + lengthDensity) * 100) / 100

    // 置信度
    const confidenceMap: Record<IntentType, number> = {
      concept: 0.3,
      emotion_seed: 0.6,
      story_seed: 0.7,
      scene_request: 0.8,
      full_story: 0.9,
    }

    return {
      intentType,
      confidence: confidenceMap[intentType],
      detectedEntities: [...new Set(detectedEntities)],
      semanticDensity,
    }
  }
}

export const intentClassifier = new IntentClassifier()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

