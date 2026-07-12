// AI Knowledge Hub — Pinia Store
// Manages state for all 6 knowledge-hub pages

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { knowledgeHubService } from '../services/index';
import type {
  DashboardMetrics,
  Brand,
  Product,
  KnowledgeArticle,
  Entity,
  Publication,
} from '../types/index';

export const useKnowledgeHubStore = defineStore('knowledgeHub', () => {
  // ===== State =====
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Dashboard
  const dashboard = ref<DashboardMetrics | null>(null);

  // Lists
  const brands = ref<Brand[]>([]);
  const products = ref<Product[]>([]);
  const articles = ref<KnowledgeArticle[]>([]);
  const entities = ref<Entity[]>([]);
  const publications = ref<Publication[]>([]);
  const readiness = ref<Record<string, number>>({});

  // ===== Computed =====
  const hasData = computed(() => !!dashboard.value);
  const brandCount = computed(() => brands.value.length);
  const productCount = computed(() => products.value.length);
  const articleCount = computed(() => articles.value.length);
  const entityCount = computed(() => entities.value.length);
  const publicationCount = computed(() => publications.value.length);

  // ===== Actions =====
  async function fetchDashboard() {
    isLoading.value = true;
    error.value = null;
    try {
      dashboard.value = await knowledgeHubService.getDashboard();
    } catch (err: any) {
      error.value = err.message || 'Failed to load dashboard';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchBrands() {
    isLoading.value = true;
    error.value = null;
    try {
      brands.value = await knowledgeHubService.getBrands();
    } catch (err: any) {
      error.value = err.message || 'Failed to load brands';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchProducts() {
    isLoading.value = true;
    error.value = null;
    try {
      products.value = await knowledgeHubService.getProducts();
    } catch (err: any) {
      error.value = err.message || 'Failed to load products';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchArticles() {
    isLoading.value = true;
    error.value = null;
    try {
      articles.value = await knowledgeHubService.getArticles();
    } catch (err: any) {
      error.value = err.message || 'Failed to load articles';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchEntities() {
    isLoading.value = true;
    error.value = null;
    try {
      entities.value = await knowledgeHubService.getEntities();
    } catch (err: any) {
      error.value = err.message || 'Failed to load entities';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPublications() {
    isLoading.value = true;
    error.value = null;
    try {
      publications.value = await knowledgeHubService.getPublications();
    } catch (err: any) {
      error.value = err.message || 'Failed to load publications';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchReadiness() {
    try {
      readiness.value = await knowledgeHubService.getReadiness();
    } catch (err: any) {
      console.warn('[knowledge-hub] Failed to fetch readiness:', err.message);
    }
  }

  return {
    // State
    isLoading,
    error,
    dashboard,
    brands,
    products,
    articles,
    entities,
    publications,
    readiness,
    // Computed
    hasData,
    brandCount,
    productCount,
    articleCount,
    entityCount,
    publicationCount,
    // Actions
    fetchDashboard,
    fetchBrands,
    fetchProducts,
    fetchArticles,
    fetchEntities,
    fetchPublications,
    fetchReadiness,
  };
});
