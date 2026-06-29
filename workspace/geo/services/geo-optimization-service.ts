/**
 * GEO Optimization Service — SEO/visibility optimization.
 *
 * Manages visibility analysis, keyword optimization, and SEO recommendations.
 * Uses GEOApiClient for all HTTP communication. No direct fetch() calls.
 *
 * @package workspace/geo/services
 */

import { GEOApiClient } from './api-client';

/**
 * Visibility score data.
 */
export interface VisibilityScore {
  overall: number;
  searchEngine: number;
  socialMedia: number;
  newsMentions: number;
  aiVisibility: number;
  lastUpdated: string;
}

/**
 * Keyword optimization suggestion.
 */
export interface KeywordSuggestion {
  keyword: string;
  volume: number;
  difficulty: number;
  currentRank: number | null;
  suggestion: 'optimize' | 'create' | 'improve' | 'ignore';
  reason: string;
}

/**
 * SEO recommendation.
 */
export interface SEORecommendation {
  id: string;
  type: 'meta' | 'content' | 'technical' | 'schema' | 'link';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: number;
  effort: 'small' | 'medium' | 'large';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

/**
 * Competitor analysis result.
 */
export interface CompetitorAnalysis {
  competitorUrl: string;
  competitorName: string;
  visibilityScore: number;
  keywordsOverlap: string[];
  strengths: string[];
  weaknesses: string[];
  gapOpportunities: string[];
}

/**
 * GEO Optimization Service.
 */
export class GEOOptimizationService {
  private client: GEOApiClient;

  constructor(client?: GEOApiClient) {
    this.client = client ?? new GEOApiClient();
  }

  /**
   * Get visibility score for a project.
   */
  async getVisibilityScore(projectId: string): Promise<VisibilityScore | null> {
    const res = await this.client.get<VisibilityScore>(`/projects/${projectId}/visibility`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get keyword suggestions for optimization.
   */
  async getKeywordSuggestions(projectId: string): Promise<KeywordSuggestion[]> {
    const res = await this.client.get<KeywordSuggestion[]>(`/projects/${projectId}/keywords`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  /**
   * Get SEO recommendations.
   */
  async getSEORecommendations(projectId: string): Promise<SEORecommendation[]> {
    const res = await this.client.get<SEORecommendation[]>(`/projects/${projectId}/seo-recommendations`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  /**
   * Update SEO recommendation status.
   */
  async updateRecommendationStatus(recommendationId: string, status: SEORecommendation['status']): Promise<boolean> {
    const res = await this.client.patch<null>(`/seo-recommendations/${recommendationId}`, { status });
    return res.success;
  }

  /**
   * Get competitor analysis.
   */
  async getCompetitorAnalysis(projectId: string, competitorUrl: string): Promise<CompetitorAnalysis | null> {
    const res = await this.client.post<CompetitorAnalysis>(`/projects/${projectId}/competitors`, { url: competitorUrl });
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Trigger full visibility analysis.
   */
  async runVisibilityAnalysis(projectId: string): Promise<boolean> {
    const res = await this.client.post<null>(`/brand/analyze`, { projectId, type: 'visibility' });
    return res.success;
  }
}
