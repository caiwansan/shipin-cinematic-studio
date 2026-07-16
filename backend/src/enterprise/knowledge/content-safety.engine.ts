/**
 * Enterprise Content Safety Engine v1.0
 * 
 * 修正：不叫"AI Review"，这是规则引擎
 * 未来Phase 5升级为Hybrid Review + AI Compliance Agent
 * 
 * 5条规则，总分100：
 * - 敏感词过滤 40分
 * - 内容长度 20分
 * - 品牌安全 20分
 * - 广告合规 10分
 * - 格式规范 10分
 * 
 * 通过线：≥80分
 */

export interface SafetyReviewResult {
  score: number;           // 0-100
  passed: boolean;         // >=80为通过
  riskLevel: 'low' | 'medium' | 'high';
  ruleResults: RuleResult[];
  summary: string;         // 人类可读的审核总结
  suggestion?: string;     // 改进建议
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  maxScore: number;
  actualScore: number;
  passed: boolean;
  note: string;
}

// 敏感词库
const SENSITIVE_WORDS = [
  // 政治敏感
  '国家领导人', 'political',
  // 竞品对比
  '比XX好', '超越XX', 'XX不如',
  // 虚假宣传
  '国家级', '最高级', '最佳', '第一', '唯一', '绝对',
  '100%', '全网最低', '永久', '包治百病',
  // 金融违规
  '保本', '稳赚', '零风险', '高收益',
];

// 绝对化用词
const ABSOLUTE_WORDS = [
  '全国第一', '全网最低', '史上最', '100%', '绝对',
  '永久', '无敌', '完美无缺', '绝无仅有'
];

// 品牌词提示
const BRAND_HINTS = ['昆仑镜', 'AI员工', '企业数字', 'Kunlun'];

export class ContentSafetyEngine {
  
  /**
   * 执行内容安全审核
   */
  review(title: string, body: string): SafetyReviewResult {
    const content = `${title}\n${body}`;
    const ruleResults: RuleResult[] = [];
    
    // 规则1: 敏感词过滤 (40分)
    const sensitiveResult = this.checkSensitiveWords(content);
    ruleResults.push(sensitiveResult);
    
    // 规则2: 内容长度 (20分)
    const lengthResult = this.checkLength(body);
    ruleResults.push(lengthResult);
    
    // 规则3: 品牌安全 (20分)
    const brandResult = this.checkBrandSafety(content);
    ruleResults.push(brandResult);
    
    // 规则4: 广告合规 (10分)
    const adResult = this.checkAdCompliance(content);
    ruleResults.push(adResult);
    
    // 规则5: 格式规范 (10分)
    const formatResult = this.checkFormat(title, body);
    ruleResults.push(formatResult);
    
    const totalScore = ruleResults.reduce((sum, r) => sum + r.actualScore, 0);
    const passed = totalScore >= 80;
    const hasCriticalFail = ruleResults.some(r => r.maxScore >= 20 && r.actualScore === 0);
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalScore < 60) riskLevel = 'high';
    else if (totalScore < 80) riskLevel = 'medium';
    
    // 生成总结
    const passedRules = ruleResults.filter(r => r.passed).length;
    const summary = `审核${passed ? '通过' : '未通过'} (${totalScore}/100)。${passedRules}/5项规则通过。`;
    
    // 生成建议
    let suggestion: string | undefined;
    if (!passed) {
      const failedRules = ruleResults.filter(r => !r.passed).map(r => r.ruleName);
      suggestion = `建议修改: ${failedRules.join('、')}`;
    }
    
    // 敏感词直接high risk
    if (sensitiveResult.actualScore === 0) {
      riskLevel = 'high';
    }
    
    return {
      score: totalScore,
      passed,
      riskLevel,
      ruleResults,
      summary,
      suggestion
    };
  }
  
  /**
   * 规则1: 敏感词过滤 (40分)
   * 任何敏感词→0分，无敏感词→40分
   */
  private checkSensitiveWords(content: string): RuleResult {
    const hits = SENSITIVE_WORDS.filter(w => content.includes(w));
    const score = hits.length === 0 ? 40 : 0;
    const passed = hits.length === 0;
    
    return {
      ruleId: 'sensitive_words',
      ruleName: '敏感词过滤',
      maxScore: 40,
      actualScore: score,
      passed,
      note: passed ? '无敏感词' : `命中敏感词: ${hits.slice(0, 3).join(', ')}`
    };
  }
  
  /**
   * 规则2: 内容长度 (20分)
   * 100-5000字→20分，<100→5分，>5000→10分
   */
  private checkLength(body: string): RuleResult {
    const len = body.length;
    let score = 20;
    if (len < 100) score = 5;
    else if (len > 5000) score = 10;
    
    return {
      ruleId: 'content_length',
      ruleName: '内容长度',
      maxScore: 20,
      actualScore: score,
      passed: score >= 20,
      note: `${len}字 ${score === 20 ? '✓' : len < 100 ? '过短' : '过长'}`
    };
  }
  
  /**
   * 规则3: 品牌安全 (20分)
   * 含品牌词→20分，无→10分
   */
  private checkBrandSafety(content: string): RuleResult {
    const hasBrand = BRAND_HINTS.some(b => content.includes(b));
    const score = hasBrand ? 20 : 10;
    
    return {
      ruleId: 'brand_safety',
      ruleName: '品牌安全',
      maxScore: 20,
      actualScore: score,
      passed: hasBrand,
      note: hasBrand ? '✓ 含品牌词' : '未提及品牌'
    };
  }
  
  /**
   * 规则4: 广告合规 (10分)
   * 无绝对化用词→10分，有→0分
   */
  private checkAdCompliance(content: string): RuleResult {
    const hits = ABSOLUTE_WORDS.filter(w => content.includes(w));
    const score = hits.length === 0 ? 10 : 0;
    
    return {
      ruleId: 'ad_compliance',
      ruleName: '广告合规',
      maxScore: 10,
      actualScore: score,
      passed: hits.length === 0,
      note: hits.length === 0 ? '✓ 合规' : `绝对化用词: ${hits.slice(0, 2).join(', ')}`
    };
  }
  
  /**
   * 规则5: 格式规范 (10分)
   * 含标题+正文+CTA→10分，缺任一→5分
   */
  private checkFormat(title: string, body: string): RuleResult {
    const hasTitle = title.trim().length > 0;
    const hasBody = body.trim().length > 10;
    const hasCTA = body.includes('联系') || body.includes('咨询') || body.includes('点击') || body.includes('扫码');
    
    let score = 5;
    if (hasTitle && hasBody && hasCTA) score = 10;
    else if (hasTitle && hasBody) score = 7;
    
    return {
      ruleId: 'format_check',
      ruleName: '格式规范',
      maxScore: 10,
      actualScore: score,
      passed: score === 10,
      note: `${hasTitle ? '✓' : '✗'}标题 ${hasBody ? '✓' : '✗'}正文 ${hasCTA ? '✓' : '✗'}CTA`
    };
  }
}

export const contentSafetyEngine = new ContentSafetyEngine();
