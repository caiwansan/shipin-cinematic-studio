/**
 * SIE — Scenario Intelligence Engine
 * DiscoveryContextBuilder — 从各数据源构建 DiscoveryContext
 *
 * P2-T002-SIE-02: 统一输入模型。
 *
 * Builder 不对 Project/API/Route 有任何依赖，只加工 DiscoverySource。
 * Pipeline 和 Matcher 只认识 DiscoveryContext，不知道数据来源。
 *
 * Tokenization 策略：
 * - brandName：品牌名原文
 * - industry：行业标识（中文/英文）
 * - description + website：提取有意义的中英文 Token
 * - 所有 Token 去重后合并到 profileTokens
 */

import { DiscoveryContext } from './matcher/matcher.interface';
import { normalize, uniqueChars } from './matcher/normalize';

/**
 * DiscoverySource — Builder 的输入模型
 *
 * 不依赖 Project Entity，未来可来自：
 * - Project
 * - Brand Import
 * - API
 * - Batch Job
 * - CRM / CMS 导入
 */
export interface DiscoverySource {
  /** 品牌名（必填） */
  name: string;
  /** 行业标识（如 'AI', 'Education'） */
  industry?: string;
  /** 品牌描述 */
  description?: string;
  /** 官网 URL */
  website?: string;
  /** 别名（预留） */
  aliases?: string[];
  /** 标签（预留） */
  tags?: string[];
  /** 语言（预留，默认 zh） */
  locale?: string;
}

/**
 * 从 DiscoverySource 构建 DiscoveryContext
 *
 * 步骤：
 * 1. 归一化 brandName
 * 2. 从 name + industry + description + website 提取 profileTokens
 * 3. 构建完整的 context（含预留字段）
 */
export function buildDiscoveryContext(source: DiscoverySource): DiscoveryContext {
  const brandName = (source.name || '').trim();
  const normalized = normalize(brandName);

  // Tokenization: 从各字段提取有意义的中英文 Token
  const tokens = new Set<string>();

  // brandName 分词：中文单字和英文单词拆分
  const nameChars = extractMeaningfulTokens(brandName);
  for (const t of nameChars) {
    if (t.length >= 1) tokens.add(t);
  }

  // industry
  if (source.industry) {
    const industryTokens = extractMeaningfulTokens(source.industry);
    for (const t of industryTokens) {
      if (t.length >= 1) tokens.add(t);
    }
  }

  // description
  if (source.description) {
    const descTokens = extractMeaningfulTokens(source.description);
    for (const t of descTokens) {
      if (t.length >= 2) tokens.add(t);
    }
  }

  // website：提取域名主体
  if (source.website) {
    const domain = extractDomain(source.website);
    if (domain) {
      tokens.add(domain);
      // 域名进一步拆分
      const parts = domain.split(/[.\-_]/);
      for (const p of parts) {
        if (p.length >= 2) tokens.add(p.toLowerCase());
      }
    }
  }

  const profileTokens = Array.from(tokens).filter(Boolean);

  return {
    brandName,
    normalized,
    industry: source.industry,
    description: source.description,
    website: source.website,
    aliases: source.aliases,
    tags: source.tags,
    locale: source.locale || 'zh',
    profileTokens,
  };
}

/**
 * 从字符串中提取有意义的中英文 Token
 * - 中文：拆分中文字符 + 提取连续中文短语 + bigram
 * - 英文：按空格拆分
 * - 数字：单独保留
 *
 * 不引入中文分词库，采用轻量策略：
 * - 连续中文字符序列保留为短语（如 "搜索平台"、"企业知识管理"）
 * - 同时生成 bigram 辅助匹配（"搜索"、"平台"、"企业"、"知识"、"管理"）
 */
function extractMeaningfulTokens(input: string): string[] {
  const tokens = new Set<string>();
  const normalized = normalize(input);

  // 提取中文字符
  const chineseChars = normalized.match(/[\u4e00-\u9fa5]/g);
  if (chineseChars) {
    // 去重单字
    const uniqueChinese = [...new Set(chineseChars)];
    for (const ch of uniqueChinese) {
      tokens.add(ch);
    }

    // 提取连续中文序列作为短语
    const chineseSequences = normalized.match(/[\u4e00-\u9fa5]+/g);
    if (chineseSequences) {
      for (const seq of chineseSequences) {
        if (seq.length >= 2) tokens.add(seq);

        // Bigram: 从序列中提取相邻两字组合
        for (let i = 0; i < seq.length - 1; i++) {
          const bigram = seq.substring(i, i + 2);
          if (bigram.length === 2) tokens.add(bigram);
        }
      }
    }
  }

  // 提取英文单词（保留原样 + 小写）
  const englishWords = normalized.match(/[a-zA-Z]+/g);
  if (englishWords) {
    for (const word of englishWords) {
      tokens.add(word.toLowerCase());
    }
  }

  // 提取数字
  const numbers = normalized.match(/\d+/g);
  if (numbers) {
    for (const num of numbers) {
      tokens.add(num);
    }
  }

  return Array.from(tokens).filter(Boolean);
}

/**
 * 从 URL 提取域名主体（去掉 www 和 TLD）
 * e.g. https://www.kunlunjing.com → kunlunjing
 */
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    // 去掉 www 前缀和 TLD 部分
    const parts = hostname.replace(/^www\./, '').split('.');
    return parts[0] || null;
  } catch {
    // 尝试直接提取
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s.:]+)/);
    return match ? match[1].split('.')[0] : null;
  }
}
