/**
 * Narrative Sequencer
 * Cinematic Grammar System — 镜头语法系统
 *
 * 叙事排序器：将一组无语法标注的镜头序列按导演语法重新排序。
 *
 * 排序策略：
 *   1. 如果不指定 type，用内容分析推断（关键词 → 语法类型映射）
 *   2. 按语法类型优先级排序（establishing → build-up → peak → release）
 *   3. 同类型按原顺序保留（不破坏用户意图）
 *
 * 排序优先级：
 *   establishing (0) < insert (1) < build-up (2) < transition (3) < reaction (4) < peak (5) < release (6)
 *
 * 场景切换时注入转场语法（scene_transition 约束）
 *
 * ─── SAM Layer (0号层) ───
 * Speech Act Marker 在 inferGrammarType 之前执行。
 * 标记为 speech_act 的 clause 会优先保留 speech_act 语义，
 * BCSG grammar rule 消费此标记来应用 dialogue 相关规则。
 */

import { ShotGrammarType, ShotGrammarNode } from './shot-grammar-tree'
import { markSpeechAct, SpeechActMark } from './speech-act-marker'

export interface NarrativeSequencedShot {
  /** 原始描述文本 */
  rawDescription: string
  /** 推断或指定的语法类型 */
  grammarType: ShotGrammarType
  /** 排序后的位置 */
  orderedPosition: number
  /** 排序后的索引 */
  sortedIndex: number
  /** SAM speech act 标记（如有） */
  speechActMark?: SpeechActMark
}

export class NarrativeSequencer {
  /**
   * 对镜头序列按语法结构排序
   */
  sequence(
    shotTexts: string[],
    grammarOverrides?: Record<number, ShotGrammarNode>,
  ): NarrativeSequencedShot[] {
    // Step 1: 推断每镜头的语法类型（含 SAM 0号层 speech act 标记）
    const inferred: { text: string; node: ShotGrammarNode & { speechActMark?: SpeechActMark }; originalIndex: number }[] =
      shotTexts.map((text, i) => ({
        text,
        node: grammarOverrides?.[i] ?? { ...this.inferGrammarType(text, i, shotTexts.length) },
        originalIndex: i,
      }))

    // Step 2: 按语法优先级排序（稳定排序，同优先级保持原序）
    const sorted = [...inferred].sort((a, b) => {
      const prioA = this.grammarPriority(a.node.type)
      const prioB = this.grammarPriority(b.node.type)
      if (prioA !== prioB) return prioA - prioB
      return a.originalIndex - b.originalIndex
    })

    // Step 3: 生成结果（传递 SAM 标记）
    return sorted.map((item, i) => ({
      rawDescription: item.text,
      grammarType: item.node.type,
      orderedPosition: item.originalIndex,
      sortedIndex: i,
      speechActMark: item.node.speechActMark,
    }))
  }

  /**
   * 从自然语言描述推断语法类型
   *
   * ─── SAM Layer (0号层) ───
   * 先检测是否为 speech act，若匹配则优先保留 speech_act 语义。
   * SAM 不决定 shot type，只做标注——BCSG grammar rule 后续消费。
   * 根据圣裁：SAM 不得影响 priority system，不得触发 shot split。
   */
  inferGrammarType(text: string, index: number, total: number): ShotGrammarNode & { speechActMark?: SpeechActMark } {
    const lower = text.toLowerCase()

    // [SAM 0号层] Speech Act 检测（仅 tag，不改变结构决策）
    const samMark = markSpeechAct(text)
    if (samMark) {
      // 对话场景：保留为 reaction（反应/对话镜头），不改变语法类型系统
      // SAM 标记附在 node 上，供 BCSG grammar rule 消费
      const baseNode = this._inferGrammarTypeInner(text, index, total)
      return { ...baseNode, speechActMark: samMark }
    }

    return this._inferGrammarTypeInner(text, index, total)
  }

  /**
   * 内部语法推断（SAM 过滤后的纯 BCSG 逻辑）
   */
  private _inferGrammarTypeInner(text: string, index: number, total: number): ShotGrammarNode {
    const lower = text.toLowerCase()

    // 第一镜尝试推断为 establishing
    if (index === 0) {
      if (
        lower.includes('引入') || lower.includes('走进') || lower.includes('来到') ||
        lower.includes('夜景') || lower.includes('外景') || lower.includes('场景') ||
        lower.includes('establish') || lower.includes('全景') || lower.includes('wide')
      ) {
        return { type: 'establishing', function: 'context', intensity: 0.3 }
      }
    }

    // 高潮（冲突/紧张/愤怒/打斗）
    if (
      lower.includes('打') || lower.includes('斗') || lower.includes('爆') ||
      lower.includes('怒') || lower.includes('冲') || lower.includes('激烈') ||
      lower.includes('碰撞') || lower.includes('威胁')
    ) {
      return { type: 'peak', function: 'action', intensity: 0.9 }
    }

    // 反应（沉默/凝视/震惊/微笑）
    if (
      lower.includes('凝视') || lower.includes('沉默') || lower.includes('震惊') ||
      lower.includes('微') || lower.includes('泪') || lower.includes('看') ||
      lower.includes('望') || lower.includes('对视')
    ) {
      return { type: 'reaction', function: 'emotion', intensity: 0.5 }
    }

    // 特写（道具/细节/环境元素）
    if (
      lower.includes('特写') || lower.includes('细节') || lower.includes('手') ||
      lower.includes('脚') || lower.includes('道具') || lower.includes('杯中') ||
      lower.includes('墙上')
    ) {
      return { type: 'insert', function: 'detail', intensity: 0.4 }
    }

    // 过渡（渐渐/然后/随后/淡入/淡出）
    if (
      lower.includes('转') || lower.includes('渐') || lower.includes('然后') ||
      lower.includes('随后') || lower.includes('淡出') || lower.includes('黑场')
    ) {
      return { type: 'transition', function: 'pause', intensity: 0.2 }
    }

    // 释放（结局/离开/走出/放下）
    if (
      lower.includes('离开') || lower.includes('走出') || lower.includes('放下') ||
      lower.includes('结束') || lower.includes('结局')
    ) {
      return { type: 'release', function: 'reaction', intensity: 0.4 }
    }

    // 最后一个镜头倾向为 release
    if (index === total - 1) {
      return { type: 'release', function: 'pause', intensity: 0.3 }
    }

    // 缺省：build-up
    return { type: 'build_up', function: 'action', intensity: 0.5 }
  }

  /**
   * 语法类型优先级（小=先出现）
   */
  private grammarPriority(type: ShotGrammarType): number {
    const order: Record<ShotGrammarType, number> = {
      establishing: 0,
      insert: 1,
      build_up: 2,
      transition: 3,
      pov: 4,
      reaction: 5,
      peak: 6,
      release: 7,
    }
    return order[type] ?? 9
  }
}
