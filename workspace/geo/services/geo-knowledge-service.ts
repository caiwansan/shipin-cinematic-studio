/**
 * GEO Knowledge Service — Knowledge graph & semantic exploration.
 *
 * Thin wrapper around GEOApiClient for knowledge graph queries
 * and semantic analysis. No direct fetch() calls.
 *
 * @package workspace/geo/services
 */

import { GEOApiClient } from './api-client';

/**
 * Knowledge graph node (entity).
 */
export interface GraphNode {
  id: string;
  projectId: string;
  name: string;
  type: 'brand' | 'product' | 'person' | 'organization' | 'topic' | 'concept' | 'keyword';
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Knowledge graph edge (relationship).
 */
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph data.
 */
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Semantic entity with aliases and relations.
 */
export interface SemanticEntity {
  id: string;
  name: string;
  aliases: string[];
  type: string;
  description?: string;
  taxonomy?: string;
  keywords: string[];
  relatedEntities: Array<{ id: string; name: string; relation: string }>;
}

/**
 * Semantic search result.
 */
export interface SemanticSearchResult {
  entities: SemanticEntity[];
  query: string;
  totalResults: number;
}

/**
 * GEO Knowledge Service.
 */
export class GEOKnowledgeService {
  private client: GEOApiClient;

  constructor(client?: GEOApiClient) {
    this.client = client ?? new GEOApiClient();
  }

  /**
   * Get knowledge graph for a project.
   */
  async getKnowledgeGraph(projectId: string): Promise<KnowledgeGraph | null> {
    const res = await this.client.get<KnowledgeGraph>(`/projects/${projectId}/knowledge-graph`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Add nodes and edges to knowledge graph.
   */
  async updateKnowledgeGraph(projectId: string, nodes: Partial<GraphNode>[], edges: Partial<GraphEdge>[]): Promise<boolean> {
    const res = await this.client.patch<null>(`/projects/${projectId}/knowledge-graph`, { nodes, edges });
    return res.success;
  }

  /**
   * Semantic search across project knowledge.
   */
  async semanticSearch(projectId: string, query: string): Promise<SemanticSearchResult | null> {
    const res = await this.client.get<SemanticSearchResult>(
      `/projects/${projectId}/semantic/search?q=${encodeURIComponent(query)}`,
    );
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get semantic entities for a project.
   */
  async getSemanticEntities(projectId: string): Promise<SemanticEntity[]> {
    const res = await this.client.get<SemanticEntity[]>(`/projects/${projectId}/semantic/entities`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }
}
