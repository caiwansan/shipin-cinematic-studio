// AI Knowledge Hub — API Client
import type { DashboardMetrics, Brand, Product, KnowledgeArticle, Entity, Publication } from '../types/index';

const BASE_URL = '/api/v1/ai-knowledge';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const knowledgeApi = {
  // Dashboard
  getDashboard(): Promise<DashboardMetrics> {
    return fetchJSON(`${BASE_URL}/dashboard`);
  },

  // Brand
  getBrands(): Promise<Brand[]> {
    return fetchJSON(`${BASE_URL}/brands`);
  },
  getBrand(id: string): Promise<Brand> {
    return fetchJSON(`${BASE_URL}/brands/${id}`);
  },
  createBrand(data: Partial<Brand>): Promise<Brand> {
    return fetchJSON(`${BASE_URL}/brands`, { method: 'POST', body: JSON.stringify(data) });
  },
  updateBrand(id: string, data: Partial<Brand>): Promise<Brand> {
    return fetchJSON(`${BASE_URL}/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteBrand(id: string): Promise<void> {
    return fetchJSON(`${BASE_URL}/brands/${id}`, { method: 'DELETE' });
  },

  // Product
  getProducts(): Promise<Product[]> {
    return fetchJSON(`${BASE_URL}/products`);
  },
  getProduct(id: string): Promise<Product> {
    return fetchJSON(`${BASE_URL}/products/${id}`);
  },

  // Article
  getArticles(): Promise<KnowledgeArticle[]> {
    return fetchJSON(`${BASE_URL}/articles`);
  },
  getArticle(id: string): Promise<KnowledgeArticle> {
    return fetchJSON(`${BASE_URL}/articles/${id}`);
  },

  // Entity
  getEntities(): Promise<Entity[]> {
    return fetchJSON(`${BASE_URL}/entities`);
  },
  getEntity(id: string): Promise<Entity> {
    return fetchJSON(`${BASE_URL}/entities/${id}`);
  },

  // Publication
  getPublications(): Promise<Publication[]> {
    return fetchJSON(`${BASE_URL}/publications`);
  },

  // Readiness
  getReadiness(): Promise<Record<string, number>> {
    return fetchJSON(`${BASE_URL}/readiness`);
  },
};
