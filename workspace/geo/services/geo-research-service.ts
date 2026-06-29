/**
 * GEO Research Service — Brand research & website scanning.
 *
 * Thin wrapper around GEOApiClient for brand profile
 * and website snapshot operations. No direct fetch() calls.
 *
 * @package workspace/geo/services
 */

import { GEOApiClient } from './api-client';

/**
 * Brand profile data model.
 */
export interface BrandProfile {
  id: string;
  projectId: string;
  brandName: string;
  description?: string;
  logo?: string;
  website?: string;
  industry?: string;
  targetMarket?: string;
  keywords?: string[];
  competitors?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Website snapshot data model.
 */
export interface WebsiteSnapshot {
  id: string;
  projectId: string;
  url: string;
  title?: string;
  description?: string;
  status: 'pending' | 'scanning' | 'completed' | 'error';
  pages?: number;
  issues?: number;
  error?: string;
  scannedAt?: string;
  createdAt: string;
}

/**
 * Brand analysis result.
 */
export interface BrandAnalysisResult {
  brandId: string;
  profile: BrandProfile;
  snapshot?: WebsiteSnapshot;
  analysis: {
    mentions: number;
    sentiment: number;
    visibility: number;
    recommendations: string[];
  };
}

/**
 * GEO Research Service.
 */
export class GEOResearchService {
  private client: GEOApiClient;

  constructor(client?: GEOApiClient) {
    this.client = client ?? new GEOApiClient();
  }

  /**
   * Get brand profile for a project.
   */
  async getBrandProfile(projectId: string): Promise<BrandProfile | null> {
    const res = await this.client.get<BrandProfile>(`/brand/profile/${projectId}`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Save brand profile.
   */
  async saveBrandProfile(projectId: string, profile: Partial<BrandProfile>): Promise<BrandProfile | null> {
    const res = await this.client.post<BrandProfile>(`/brand/profile/${projectId}`, profile);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get website snapshot for a project.
   */
  async getWebsiteSnapshot(projectId: string): Promise<WebsiteSnapshot | null> {
    const res = await this.client.get<WebsiteSnapshot>(`/projects/${projectId}/snapshot`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Trigger website scan for a project.
   */
  async scanWebsite(projectId: string, url: string): Promise<WebsiteSnapshot | null> {
    const res = await this.client.post<WebsiteSnapshot>(`/brand/analyze`, { projectId, url });
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get full brand analysis for a project.
   */
  async analyzeBrand(projectId: string): Promise<BrandAnalysisResult | null> {
    const res = await this.client.post<BrandAnalysisResult>(`/brand/analyze`, { projectId, deep: true });
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }
}
