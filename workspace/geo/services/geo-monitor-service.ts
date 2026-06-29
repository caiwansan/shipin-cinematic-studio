/**
 * GEO Monitor Service — Monitoring & analytics dashboard.
 *
 * Tracks project health, performance metrics, and alerts.
 * Uses GEOApiClient for all HTTP communication. No direct fetch() calls.
 *
 * @package workspace/geo/services
 */

import { GEOApiClient } from './api-client';

/**
 * Project health metrics.
 */
export interface HealthMetrics {
  overall: number;
  visibility: number;
  citations: number;
  sentiment: number;
  coverage: number;
  lastUpdated: string;
}

/**
 * Performance trend point.
 */
export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Alert definition.
 */
export interface Alert {
  id: string;
  projectId: string;
  type: 'visibility_drop' | 'sentiment_drop' | 'citation_loss' | 'competitor_movement' | 'technical_issue';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  dismissed: boolean;
}

/**
 * Dashboard summary.
 */
export interface DashboardSummary {
  healthMetrics: HealthMetrics;
  visibilityTrend: TrendPoint[];
  citationTrend: TrendPoint[];
  recentAlerts: Alert[];
  totalProjects: number;
  activeAnalyses: number;
}

/**
 * GEO Monitor Service.
 */
export class GEOMonitorService {
  private client: GEOApiClient;

  constructor(client?: GEOApiClient) {
    this.client = client ?? new GEOApiClient();
  }

  /**
   * Get dashboard summary for a project.
   */
  async getDashboardSummary(projectId: string): Promise<DashboardSummary | null> {
    const res = await this.client.get<DashboardSummary>(`/dashboard/${projectId}`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get project health metrics.
   */
  async getHealthMetrics(projectId: string): Promise<HealthMetrics | null> {
    const res = await this.client.get<HealthMetrics>(`/projects/${projectId}/health`);
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  }

  /**
   * Get alerts for a project.
   */
  async getAlerts(projectId: string): Promise<Alert[]> {
    const res = await this.client.get<Alert[]>(`/projects/${projectId}/alerts`);
    if (res.success && res.data) {
      return res.data;
    }
    return [];
  }

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const res = await this.client.post<null>(`/alerts/${alertId}/acknowledge`);
    return res.success;
  }
}
