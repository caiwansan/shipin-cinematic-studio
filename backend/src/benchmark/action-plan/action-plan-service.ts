/**
 * Action Plan Service — 机会 → 行动方案引擎
 *
 * P0-T007 — Action Plan Engine
 *
 * 职责：
 *   1. 接收 Opportunity[] → 根据 templateId 匹配 → 生成 ActionPlan[]
 *   2. 每个 Opportunity 匹配最合适的模板
 *   3. 计算每个 ActionPlan 的 estimatedImpact
 *   4. 参数化模板内容（entityName/scenarioName 填充）
 */

import { ActionPlan } from './types';
import { Opportunity } from '../opportunity/types';
import { ACTION_PLAN_TEMPLATES } from './templates';

/** Scenario suggestion → templateId mapping */
const SUGGESTION_TEMPLATE_MAP: Record<string, string> = {
  'missing-faq': 'missing-faq',
  'faq': 'missing-faq',
  'pricing': 'missing-pricing',
  'comparison': 'missing-comparison',
  'case-study': 'missing-case-study',
  'author': 'missing-author',
  'eeat': 'weak-eeat',
  'e-e-a-t': 'weak-eeat',
  'structured-data': 'no-structured-data',
  'structured data': 'no-structured-data',
  'schema': 'no-structured-data',
  'citation': 'no-citation',
  'thin-content': 'thin-content',
  'thin content': 'thin-content',
  'update-date': 'no-update-date',
  'update date': 'no-update-date',
  'freshness': 'no-update-date',
  'basic-info': 'missing-basic-info',
  'basic info': 'missing-basic-info',
  'position': 'position-low',
  'ranking': 'position-low',
  'social-proof': 'no-social-proof',
  'social proof': 'no-social-proof',
  'mobile': 'bad-mobile',
  'speed': 'slow-loading',
  'loading': 'slow-loading',
  'performance': 'slow-loading',
  'video': 'missing-video',
  'image': 'missing-images',
  'testimonial': 'no-testimonials',
  'review': 'insufficient-reviews',
  'competitor': 'competitors-ahead',
  'competitive': 'competitors-ahead',
  'blog': 'no-blog',
  'content': 'no-blog',
  'cta': 'poor-cta',
  'call-to-action': 'poor-cta',
  'breadcrumb': 'no-schema-breadcrumb',
  'breadcrumbs': 'no-schema-breadcrumb',
  'faq-schema': 'missing-faq-schema',
  'faq schema': 'missing-faq-schema',
  'local-seo': 'no-local-seo',
  'local seo': 'no-local-seo',
  'local': 'no-local-seo',
  'about': 'missing-about-page',
  'about-page': 'missing-about-page',
  'about page': 'missing-about-page',
  'privacy': 'no-privacy-policy',
  'privacy-policy': 'no-privacy-policy',
  'privacy policy': 'no-privacy-policy',
  'demo': 'missing-product-demo',
  'product-demo': 'missing-product-demo',
  'product demo': 'missing-product-demo',
  'navigation': 'poor-navigation',
  'contact': 'no-contact-info',
  'support': 'customer-support',
  'customer-support': 'customer-support',
  'customer support': 'customer-support',
  'mobile-app': 'missing-mobile-app',
  'mobile app': 'missing-mobile-app',
  'app': 'missing-mobile-app',
};

/**
 * Try to infer a templateId from Opportunity properties
 */
function inferTemplateId(opp: Opportunity): string | null {
  // Check tags first (most reliable)
  for (const tag of opp.tags) {
    const lowerTag = tag.toLowerCase();
    for (const [key, templateId] of Object.entries(SUGGESTION_TEMPLATE_MAP)) {
      if (lowerTag.includes(key)) return templateId;
    }
  }

  // Check suggestion text
  const lowerSuggestion = opp.suggestion.toLowerCase();
  for (const [key, templateId] of Object.entries(SUGGESTION_TEMPLATE_MAP)) {
    if (lowerSuggestion.includes(key)) return templateId;
  }

  // Check scenario name
  const lowerScenario = opp.scenarioName.toLowerCase();
  for (const [key, templateId] of Object.entries(SUGGESTION_TEMPLATE_MAP)) {
    if (lowerScenario.includes(key)) return templateId;
  }

  // Check reason text
  const lowerReason = opp.reason.toLowerCase();
  for (const [key, templateId] of Object.entries(SUGGESTION_TEMPLATE_MAP)) {
    if (lowerReason.includes(key)) return templateId;
  }

  return null;
}

/**
 * Generate ActionPlans from Opportunities
 */
function generateActionPlans(
  opportunities: Opportunity[],
  entityName: string,
): ActionPlan[] {
  return opportunities
    .map((opp) => {
      const templateId = inferTemplateId(opp);
      if (!templateId) return null;

      const template = ACTION_PLAN_TEMPLATES.find(
        (tpl) => tpl.templateId === templateId,
      );
      if (!template) return null;

      // Parameterize template content with entityName/scenarioName
      const parameterizedTitle = template.title.replace(
        /\{entityName\}/g,
        entityName,
      ).replace(/\{scenarioName\}/g, opp.scenarioName);

      const parameterizedDescription = template.description.replace(
        /\{entityName\}/g,
        entityName,
      ).replace(/\{scenarioName\}/g, opp.scenarioName);

      const parameterizedSteps = template.steps.map((s) => ({
        ...s,
        title: s.title.replace(/\{entityName\}/g, entityName).replace(/\{scenarioName\}/g, opp.scenarioName),
        description: s.description.replace(/\{entityName\}/g, entityName).replace(/\{scenarioName\}/g, opp.scenarioName),
      }));

      // Calculate estimatedImpact: inherit from opportunity + template weight
      const templateImpactAdjustment = getTemplateImpactAdjustment(templateId);
      const estimatedImpact = Math.round(opp.expectedAdiGain * templateImpactAdjustment);

      return {
        id: `ap-${opp.id}-${templateId}`,
        title: parameterizedTitle,
        description: parameterizedDescription,
        priority: opp.priority,
        estimatedImpact: Math.max(1, estimatedImpact),
        estimatedEffort: template.estimatedEffort,
        estimatedTime: template.estimatedTime,
        steps: parameterizedSteps,
        relatedOpportunityId: opp.id,
        relatedScenarioId: opp.scenarioId,
        status: 'pending' as const,
        tags: [...template.tags, ...opp.tags.filter((t) => !template.tags.includes(t))],
      };
    })
    .filter(Boolean) as ActionPlan[];
}

/**
 * Template-specific impact multiplier
 */
function getTemplateImpactAdjustment(templateId: string): number {
  const adjustments: Record<string, number> = {
    'missing-faq': 1.0,
    'missing-pricing': 1.1,
    'missing-comparison': 1.0,
    'missing-case-study': 1.2,
    'missing-author': 0.8,
    'weak-eeat': 1.3,
    'no-structured-data': 1.0,
    'no-citation': 0.9,
    'thin-content': 1.1,
    'no-update-date': 0.7,
    'missing-basic-info': 0.8,
    'position-low': 1.3,
    'no-social-proof': 0.9,
    'bad-mobile': 1.1,
    'slow-loading': 1.2,
    'missing-video': 1.0,
    'missing-images': 0.8,
    'no-testimonials': 0.9,
    'insufficient-reviews': 0.8,
    'competitors-ahead': 1.2,
    'no-blog': 1.1,
    'poor-cta': 0.7,
    'no-schema-breadcrumb': 0.6,
    'missing-faq-schema': 0.7,
    'no-local-seo': 1.0,
    'missing-about-page': 0.9,
    'no-privacy-policy': 0.6,
    'missing-product-demo': 1.2,
    'poor-navigation': 1.0,
    'no-contact-info': 0.7,
    'customer-support': 1.1,
    'missing-mobile-app': 0.9,
  };
  return adjustments[templateId] ?? 1.0;
}

/**
 * Action Plan Service — 单例
 */
export class ActionPlanService {
  /**
   * 从 Opportunity[] 生成 ActionPlan[]
   *
   * @param opportunities 优化机会列表（来自 OpportunityService）
   * @param entityName    实体名称（用于模板参数化填充）
   * @returns ActionPlan[]
   */
  generatePlans(
    opportunities: Opportunity[],
    entityName: string,
  ): ActionPlan[] {
    return generateActionPlans(opportunities, entityName);
  }
}

/** Singleton */
export const actionPlanService = new ActionPlanService();
