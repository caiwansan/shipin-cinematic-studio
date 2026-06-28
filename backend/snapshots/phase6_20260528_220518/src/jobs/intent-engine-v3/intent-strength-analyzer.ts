/**
 * Intent Strength Analyzer v3 — 意图强度建模
 *
 * 判断输入有多"完整"，强度越高系统越不需要自主扩展。
 * 规则引擎 + 简单统计特征，不调 LLM。
 */

export interface IntentStrength {
  intentStrength: number      // 0-1: 整体意图强度
  completeness: number        // 0-1: 内容完整度
  expansionNeed: 'low' | 'medium' | 'high'
}

export class IntentStrengthAnalyzer {
  analyze(input: string, charCount: number, entityCount: number): IntentStrength {
    // 长度因子（长文本 → 更完整）
    const lengthScore = Math.min(input.length / 1000, 1.0)

    // 结构因子：是否有明显的结构化标记
    const hasStructure = /[第章集对话：:]/g.test(input)
    const structureScore = hasStructure ? 0.8 : Math.min(input.length / 500, 0.6)

    // 实体密度因子
    const entityScore = Math.min(entityCount / 10, 1.0)

    // 标点密度（标点越多越像完整故事）
    const punctuationCount = (input.match(/[，。！？、：；""''（）\n]/g) || []).length
    const punctuationScore = Math.min(punctuationCount / 20, 1.0)

    // 综合得分
    const completeness = Math.round(
      (lengthScore * 0.3 + structureScore * 0.3 + entityScore * 0.2 + punctuationScore * 0.2) * 100
    ) / 100

    // 意图强度 = 完整度 * 0.7 + 字数因子 * 0.3
    const intentStrength = Math.round(
      (completeness * 0.7 + lengthScore * 0.3) * 100
    ) / 100

    // 扩展需求
    let expansionNeed: 'low' | 'medium' | 'high'
    if (intentStrength > 0.7) expansionNeed = 'low'
    else if (intentStrength > 0.3) expansionNeed = 'medium'
    else expansionNeed = 'high'

    return { intentStrength, completeness, expansionNeed }
  }
}

export const intentStrengthAnalyzer = new IntentStrengthAnalyzer()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

