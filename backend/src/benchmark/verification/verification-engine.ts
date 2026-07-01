/**
 * Verification Engine — 规则引擎
 *
 * P0-T008 — Verification Engine MVP
 *
 * 全部 deterministic 规则：
 *   - Before/After ADI 计算
 *   - 维度变化（coverage / share / position）
 *   - Improvement Breakdown（按模板类型分组）
 *   - Confidence 计算（按 completionRate 分段）
 */

import { DiscoveryReport } from '../discovery/types';
import { ActionPlan, ActionStep } from '../action-plan/types';
import {
  VerificationReport,
  VerifiedItem,
} from './types';

/** ActionPlan 模板 ID → 改进标签映射 */
const TEMPLATE_LABEL_MAP: Record<string, { label: string; baseContribution: number; detail: string }> = {
  'missing-faq':           { label: 'FAQ 内容完善',         baseContribution: 8,  detail: '创建 FAQ 覆盖常见问题，提升搜索可见性' },
  'missing-pricing':       { label: '定价信息补充',         baseContribution: 6,  detail: '补充完整透明的定价信息' },
  'missing-comparison':    { label: '竞品对比内容',         baseContribution: 7,  detail: '创建与主要竞品的对比内容' },
  'missing-case-study':    { label: '案例研究发布',         baseContribution: 9,  detail: '创建客户案例增强信任度' },
  'missing-author':        { label: '作者信息完善',         baseContribution: 3,  detail: '补充作者/创作者信息提升 E-E-A-T' },
  'weak-eeat':             { label: 'E-E-A-T 优化',         baseContribution: 10, detail: '全面提升经验-专业度-权威性-可信度信号' },
  'no-structured-data':    { label: '结构化数据优化',       baseContribution: 5,  detail: '添加 JSON-LD 结构化数据标记' },
  'no-citation':           { label: '引用来源补充',         baseContribution: 4,  detail: '为内容添加可靠的引用来源' },
  'thin-content':          { label: '内容深度扩充',         baseContribution: 8,  detail: '从表层信息升级为全面的指南级内容' },
  'no-update-date':        { label: '更新日期标记',         baseContribution: 2,  detail: '添加明确的最后更新日期' },
  'missing-basic-info':    { label: '品牌基本信息完善',     baseContribution: 3,  detail: '补充品牌描述和基础信息' },
  'position-low':          { label: '搜索排名提升',         baseContribution: 10, detail: '综合排名提升方案' },
  'no-social-proof':       { label: '社交证据添加',         baseContribution: 4,  detail: '添加社交证明元素' },
  'bad-mobile':            { label: '移动端体验优化',       baseContribution: 6,  detail: '优化移动端展示和交互' },
  'slow-loading':          { label: '加载速度优化',         baseContribution: 7,  detail: '提升页面加载速度' },
  'missing-video':         { label: '视频内容添加',         baseContribution: 6,  detail: '创建或嵌入视频内容' },
  'missing-images':        { label: '图片内容优化',         baseContribution: 3,  detail: '添加和优化图片内容' },
  'no-testimonials':       { label: '用户评价展示',         baseContribution: 4,  detail: '添加用户评价展示' },
  'insufficient-reviews':  { label: '用户评论增加',         baseContribution: 3,  detail: '增加用户评论数量和覆盖度' },
  'competitors-ahead':     { label: '竞品差距分析',         baseContribution: 7,  detail: '系统分析竞品差距制定赶超策略' },
  'no-blog':               { label: '博客内容建立',         baseContribution: 8,  detail: '建立博客内容体系' },
  'poor-cta':              { label: 'CTA 优化',             baseContribution: 3,  detail: '优化行动号召设计' },
  'no-schema-breadcrumb':  { label: '面包屑导航添加',       baseContribution: 2,  detail: '添加面包屑导航和 Schema' },
  'missing-faq-schema':    { label: 'FAQ Schema 添加',      baseContribution: 3,  detail: '添加 FAQPage 结构化数据' },
  'no-local-seo':          { label: '本地 SEO 优化',        baseContribution: 5,  detail: '优化本地搜索可见性' },
  'missing-about-page':    { label: '关于页面创建',         baseContribution: 4,  detail: '创建完整的关于页面' },
  'no-privacy-policy':     { label: '隐私政策添加',         baseContribution: 2,  detail: '创建隐私政策页面' },
  'missing-product-demo':  { label: '产品演示创建',         baseContribution: 6,  detail: '创建产品演示内容' },
  'poor-navigation':       { label: '网站导航优化',         baseContribution: 5,  detail: '优化网站导航结构' },
  'no-contact-info':       { label: '联系信息添加',         baseContribution: 2,  detail: '提供完整的联系信息' },
  'customer-support':      { label: '客户支持完善',         baseContribution: 5,  detail: '建立完善的支持体系' },
  'missing-mobile-app':    { label: '移动应用信息补充',     baseContribution: 3,  detail: '补充移动应用信息' },
};

/** 默认改进标签（无法识别模板时使用） */
const DEFAULT_LABEL = { label: '其他改进项', baseContribution: 3, detail: '其他优化改进' };

/**
 * 验证引擎 — 全部 deterministic 规则
 */
export class VerificationEngine {
  /**
   * 生成 VerificationReport
   *
   * @param baseline 基线 DiscoveryReport（before）
   * @param actionPlans 所有 ActionPlan（含 status）
   * @returns VerificationReport
   */
  generateReport(
    baseline: DiscoveryReport,
    actionPlans: ActionPlan[],
  ): VerificationReport {
    // ---- Step 1: Before ADI ----
    const beforeAdi = baseline.adi;

    // ---- Step 2: 计算 Action 完成情况 ----
    const totalActions = actionPlans.length;
    const completedPlans = actionPlans.filter((p) => p.status === 'completed');
    const skippedPlans = actionPlans.filter((p) => p.status === 'skipped');
    const pendingPlans = actionPlans.filter(
      (p) => p.status === 'pending' || p.status === 'later',
    );
    const completedActions = completedPlans.length;
    const skippedActions = skippedPlans.length;
    const pendingActions = pendingPlans.length;
    const completionRate =
      totalActions > 0 ? completedActions / totalActions : 0;

    // ---- Step 3: After ADI 计算 ----
    let afterAdi = beforeAdi;

    // 每个 completed 的 ActionPlan 贡献 estimatedImpact * 0.6
    for (const plan of completedPlans) {
      afterAdi += plan.estimatedImpact * 0.6;
    }

    // 每个 action 完成率 > 50% 的场景：额外 bonus 0.5 ADI
    const highCompletionPlans = actionPlans.filter(() => {
      // 模拟完成率：completed 为 100%, pending 为 0, skipped 不计数
      // 这里以 completed 的计划数占比评估
      return true;
    });
    const bonusCount = completedPlans.length > totalActions * 0.5 ? completedPlans.length : 0;
    afterAdi += bonusCount * 0.5;

    // 如果 completionRate > 80%：额外 +5 ADI
    if (completionRate > 0.8) {
      afterAdi += 5;
    }

    // 上限 95
    afterAdi = Math.min(95, Math.round(afterAdi));

    const deltaAdi = afterAdi - beforeAdi;
    const improvementRate = beforeAdi > 0
      ? Math.round((deltaAdi / beforeAdi) * 1000) / 10
      : 0;

    // ---- Step 4: 维度变化 ----
    const baselineCoverage = baseline.dimensions.coverage;
    const baselineShare = baseline.dimensions.share;
    const baselinePosition = baseline.dimensions.position;

    // gap = 100 - baseline
    const coverageGap = 100 - baselineCoverage;
    const shareGap = 100 - baselineShare;
    const positionGap = 100 - baselinePosition;

    const completionRatio = totalActions > 0 ? completedActions / totalActions : 0;

    const afterCoverage = Math.min(100, Math.round(baselineCoverage + completionRatio * coverageGap * 0.4));
    const afterShare = Math.min(100, Math.round(baselineShare + completionRatio * shareGap * 0.3));
    const afterPosition = Math.min(100, Math.round(baselinePosition + completionRatio * positionGap * 0.3));

    const dimensionChanges = {
      coverage: {
        before: baselineCoverage,
        after: afterCoverage,
        delta: afterCoverage - baselineCoverage,
      },
      share: {
        before: baselineShare,
        after: afterShare,
        delta: afterShare - baselineShare,
      },
      position: {
        before: baselinePosition,
        after: afterPosition,
        delta: afterPosition - baselinePosition,
      },
    };

    // ---- Step 5: Improvement Breakdown ----
    const breakdownMap = new Map<string, { contribution: number; detail: string }>();

    for (const plan of completedPlans) {
      // 从模板 ID 推断标签
      const templateId = this.inferTemplateIdFromPlan(plan);
      const mapping = TEMPLATE_LABEL_MAP[templateId] || DEFAULT_LABEL;

      const existing = breakdownMap.get(mapping.label);
      if (existing) {
        existing.contribution += mapping.baseContribution;
      } else {
        breakdownMap.set(mapping.label, {
          contribution: mapping.baseContribution,
          detail: mapping.detail,
        });
      }
    }

    // 处理剩余的 ADI 增量（确保总和匹配）
    const breakdownTotal = Array.from(breakdownMap.values()).reduce(
      (sum, item) => sum + item.contribution,
      0,
    );
    const remainingDelta = deltaAdi - breakdownTotal;

    // 如果剩余为正，按比例分配到各项目
    if (remainingDelta > 0 && breakdownTotal > 0) {
      breakdownMap.forEach((value) => {
        value.contribution += Math.round(
          (remainingDelta * value.contribution) / breakdownTotal,
        );
      });
    }

    const improvementBreakdown: Array<{ label: string; contribution: number; detail: string }> = [];
    breakdownMap.forEach((value, label) => {
      improvementBreakdown.push({
        label,
        contribution: value.contribution,
        detail: value.detail,
      });
    });

    // ---- Step 6: Verified Items ----
    const verifiedItems: VerifiedItem[] = [];
    let itemCounter = 0;

    for (const plan of actionPlans) {
      for (const step of plan.steps) {
        itemCounter++;
        const stepStatus = plan.status === 'completed'
          ? 'completed'
          : plan.status === 'skipped'
            ? 'skipped'
            : 'pending';

        // 如果是 completed，计算贡献值（平均分配 plan 的 impact 到各 step）
        const adiContribution =
          stepStatus === 'completed' && plan.steps.length > 0
            ? Math.round((plan.estimatedImpact * 0.6) / plan.steps.length)
            : 0;

        verifiedItems.push({
          id: `vi-${itemCounter}`,
          actionPlanId: plan.id,
          actionStepId: step.id,
          title: step.title,
          status: stepStatus,
          adiContribution,
          details: stepStatus === 'completed'
            ? `已完成：${step.description}`
            : stepStatus === 'skipped'
              ? '已跳过'
              : '待完成',
        });
      }
    }

    // ---- Step 7: Remaining Issues ----
    const remainingIssues = baseline.opportunities
      .filter((opp) => opp.gap > 0)
      .map((opp) => ({
        scenarioId: opp.scenarioId,
        scenarioName: opp.scenarioName,
        gap: opp.gap,
        priority: opp.priority,
      }))
      // 保留已匹配 ActionPlan 但未完成的场景
      .filter((issue) => {
        // 如果所有 action plan 都 completed，过滤掉该场景
        const relatedPlans = actionPlans.filter(
          (p) => p.relatedScenarioId === issue.scenarioId,
        );
        if (relatedPlans.length === 0) return true; // 无相关计划，仍是剩余问题
        return relatedPlans.some((p) => p.status !== 'completed');
      });

    // ---- Step 8: Confidence ----
    let confidence: number;
    if (completionRate > 0.8) {
      confidence = 0.9;
    } else if (completionRate >= 0.6) {
      confidence = 0.7;
    } else if (completionRate >= 0.4) {
      confidence = 0.5;
    } else {
      confidence = 0.3;
    }

    // ---- 组装报告 ----
    const report: VerificationReport = {
      id: `vr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entityId: baseline.entityId,
      entityName: baseline.entityName,
      beforeAdi,
      afterAdi,
      deltaAdi,
      improvementRate,
      dimensionChanges,
      totalActions,
      completedActions,
      skippedActions,
      pendingActions,
      completionRate: Math.round(completionRate * 10000) / 100,
      verifiedItems,
      improvementBreakdown,
      remainingIssues,
      confidence,
      verifiedAt: new Date().toISOString(),
    };

    return report;
  }

  /**
   * 从 ActionPlan 推断模板 ID
   */
  private inferTemplateIdFromPlan(plan: ActionPlan): string {
    // 从 id 中提取模板 ID（格式：ap-{oppId}-{templateId}）
    const parts = plan.id.split('-');
    if (parts.length >= 3) {
      // 最后一部分可能是 templateId
      const candidate = parts.slice(2).join('-');
      if (TEMPLATE_LABEL_MAP[candidate]) return candidate;
    }

    // 从 tags 中匹配
    for (const tag of plan.tags) {
      if (TEMPLATE_LABEL_MAP[tag]) return tag;
    }

    return 'unknown';
  }
}

/** Singleton */
export const verificationEngine = new VerificationEngine();
