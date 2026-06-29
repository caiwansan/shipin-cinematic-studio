/**
 * GEO Publish Service — Content publishing workflow.
 *
 * Manages publishing content across channels.
 * Uses GEOApiClient for all HTTP communication. No direct fetch() calls.
 *
 * @package workspace/geo/services
 */

import { GEOApiClient } from './api-client';

/**
 * Publishing channel configuration.
 */
export interface PublishChannel {
  id: string;
  name: string;
  type: 'website' | 'social' | 'newsletter' | 'knowledge_graph' | 'schema';
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Publication record.
 */
export interface Publication {
  id: string;
  projectId: string;
  title: string;
  channelId: string;
  channelName: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt?: string;
  scheduledAt?: string;
  error?: string;
  url?: string;
}

/**
 * Publish result.
 */
export interface PublishResult {
  publicationId: string;
  status: Publication['status'];
  url?: string;
  error?: string;
}

/**
 * GEO Publish Service.
 */
export class GEOPublishService {
  private client: GEOApiClient;

  constructor(client?: GEOApiClient) {
    this.client = client ?? new GEOApiClient();
  }

  /**
   * List available publish channels.
   */
  async getChannels(projectId: string): Promise<PublishChannel[]> {
    const res = await this.client.get<PublishChannel[]>(`/projects/${projectId}/channels`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  /**
   * Publish content to a channel.
   */
  async publish(
    projectId: string,
    channelId: string,
    content: { title: string; body: string; metadata?: Record<string, unknown> },
  ): Promise<PublishResult | null> {
    const res = await this.client.post<PublishResult>(`/projects/${projectId}/publish`, {
      channelId,
      ...content,
    });
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get publication history.
   */
  async getPublications(projectId: string): Promise<Publication[]> {
    const res = await this.client.get<Publication[]>(`/projects/${projectId}/publications`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }
}
