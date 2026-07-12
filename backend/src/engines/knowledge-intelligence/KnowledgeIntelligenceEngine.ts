import type { Insight } from './models/Insight'
import type { Evidence } from './models/Evidence'
import type { RuleResult } from './models/RuleResult'
import { KnowledgeEvidenceCollector, type KnowledgeObjectInput } from './KnowledgeEvidenceCollector'
import { KnowledgeAssessmentEngine } from './KnowledgeAssessmentEngine'
import { KnowledgeScoreCalculator } from './KnowledgeScoreCalculator'
import { KnowledgeRecommendationEngine } from './KnowledgeRecommendationEngine'
import { evaluateCoverageRules } from './rules/CoverageRules'
import { evaluateFreshnessRules } from './rules/FreshnessRules'
import { evaluateCitationRules } from './rules/CitationRules'
import { evaluateAuthorityRules } from './rules/AuthorityRules'
import { evaluateConsistencyRules } from './rules/ConsistencyRules'

/**
 * RuleEngine — Simple dispatcher
 *
 * Maintains a flat list of all rules and dispatches them independently.
 * Rules do NOT call each other.
 */
class RuleEngine {
  evaluate(object: KnowledgeObjectInput, evidence: Evidence[]): RuleResult[] {
    const results: RuleResult[] = []

    // Coverage rules
    results.push(
      ...evaluateCoverageRules(
        object.scenarioCount ?? Math.ceil(object.content.length / 50),
        object.totalScenarios ?? 8,
        evidence,
      ),
    )

    // Freshness rules
    results.push(...evaluateFreshnessRules(object.lastUpdated, evidence))

    // Citation rules
    results.push(
      ...evaluateCitationRules(
        object.citationCount ?? (object.content.length % 10),
        object.authoritativeCount ?? 0,
        evidence,
      ),
    )

    // Authority rules
    results.push(
      ...evaluateAuthorityRules(
        object.sourceTypes ?? (object.category === 'Product' ? ['official_website'] : ['wikipedia']),
        evidence,
      ),
    )

    // Consistency rules
    results.push(
      ...evaluateConsistencyRules(
        object.entityMentions ?? Math.ceil(object.content.length / 30),
        object.contradictions ?? 0,
        evidence,
      ),
    )

    return results
  }
}

/**
 * KnowledgeIntelligenceEngine
 *
 * Orchestrates the full pipeline:
 *   Evidence -> Rule -> Assessment -> Recommendation -> Score
 *
 * Every call to evaluate() is deterministic (idempotent) given the same input.
 */
export class KnowledgeIntelligenceEngine {
  private evidenceCollector: KnowledgeEvidenceCollector
  private ruleEngine: RuleEngine
  private assessmentEngine: KnowledgeAssessmentEngine
  private scoreCalculator: KnowledgeScoreCalculator
  private recommendationEngine: KnowledgeRecommendationEngine

  constructor() {
    this.evidenceCollector = new KnowledgeEvidenceCollector()
    this.ruleEngine = new RuleEngine()
    this.assessmentEngine = new KnowledgeAssessmentEngine()
    this.scoreCalculator = new KnowledgeScoreCalculator()
    this.recommendationEngine = new KnowledgeRecommendationEngine()
  }

  evaluate(object: KnowledgeObjectInput): Insight {
    // 1. Collect Evidence
    const evidence = this.evidenceCollector.collect(object)

    // 2. Run all rules (independently!)
    const ruleResults = this.ruleEngine.evaluate(object, evidence)

    // 3. Assess dimensions
    const assessment = this.assessmentEngine.assess(ruleResults)

    // 4. Calculate quality (from dimensions, not as a dimension itself)
    const quality = this.scoreCalculator.calculate(assessment)

    // 5. Generate recommendation
    const recommendation = this.recommendationEngine.generate(assessment)

    return {
      version: '1.0',
      assessment,
      quality,
      recommendation,
      evidence,
    }
  }
}
