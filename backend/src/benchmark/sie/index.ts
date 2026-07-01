/**
 * SIE — Scenario Intelligence Engine
 * Unified Exports
 *
 * P0-T004 — Scenario Intelligence Engine (Rule-Based)
 */

export { MatchResult, MatchType, MatchTopKRequest, KeywordEntry } from './types';
export { keywordMap, getKeywords, getAllScenarioIds, getAllKeywords } from './keyword-map';
export { ScenarioMatcher, scenarioMatcher } from './scenario-matcher';
export { testCases, TestCase, getMultiMatchCases } from './test-cases';
