// AI Knowledge Hub — API Service Layer
// Wraps the raw API client with store-friendly methods

import { knowledgeApi } from '../api/index';
import type {
  DashboardMetrics,
  Brand,
  Product,
  KnowledgeArticle,
  Entity,
  Publication,
} from '../types/index';

export class KnowledgeHubService {
  async getDashboard(): Promise<DashboardMetrics> {
    return knowledgeApi.getDashboard();
  }

  async getBrands(): Promise<Brand[]> {
    return knowledgeApi.getBrands();
  }

  async getProducts(): Promise<Product[]> {
    return knowledgeApi.getProducts();
  }

  async getArticles(): Promise<KnowledgeArticle[]> {
    return knowledgeApi.getArticles();
  }

  async getEntities(): Promise<Entity[]> {
    return knowledgeApi.getEntities();
  }

  async getPublications(): Promise<Publication[]> {
    return knowledgeApi.getPublications();
  }

  async getReadiness(): Promise<Record<string, number>> {
    return knowledgeApi.getReadiness();
  }
}

export const knowledgeHubService = new KnowledgeHubService();
