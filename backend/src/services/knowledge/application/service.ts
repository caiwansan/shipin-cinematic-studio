// AI Knowledge Hub — Application Service

import { knowledgeRepository } from '../repository/index';

export const knowledgeService = {
  // Dashboard
  async getDashboard() {
    return knowledgeRepository.getDashboard();
  },

  // Brand
  async getBrands() { return knowledgeRepository.getBrands(); },
  async getBrand(id: string) { return knowledgeRepository.getBrand(id); },
  async createBrand(data: any) { return knowledgeRepository.createBrand(data); },
  async updateBrand(id: string, data: any) { return knowledgeRepository.updateBrand(id, data); },
  async deleteBrand(id: string) { return knowledgeRepository.deleteBrand(id); },
  async getBrandCount() { return knowledgeRepository.getBrandCount(); },

  // Product
  async getProducts() { return knowledgeRepository.getProducts(); },
  async getProduct(id: string) { return knowledgeRepository.getProduct(id); },
  async createProduct(data: any) { return knowledgeRepository.createProduct(data); },
  async updateProduct(id: string, data: any) { return knowledgeRepository.updateProduct(id, data); },
  async deleteProduct(id: string) { return knowledgeRepository.deleteProduct(id); },
  async getProductCount() { return knowledgeRepository.getProductCount(); },

  // Article
  async getArticles() { return knowledgeRepository.getArticles(); },
  async getArticle(id: string) { return knowledgeRepository.getArticle(id); },
  async createArticle(data: any) { return knowledgeRepository.createArticle(data); },
  async updateArticle(id: string, data: any) { return knowledgeRepository.updateArticle(id, data); },
  async deleteArticle(id: string) { return knowledgeRepository.deleteArticle(id); },
  async getArticleCount() { return knowledgeRepository.getArticleCount(); },

  // Entity
  async getEntities() { return knowledgeRepository.getEntities(); },
  async getEntity(id: string) { return knowledgeRepository.getEntity(id); },
  async createEntity(data: any) { return knowledgeRepository.createEntity(data); },
  async updateEntity(id: string, data: any) { return knowledgeRepository.updateEntity(id, data); },
  async deleteEntity(id: string) { return knowledgeRepository.deleteEntity(id); },
  async getEntityCount() { return knowledgeRepository.getEntityCount(); },

  // Publication
  async getPublications() { return knowledgeRepository.getPublications(); },
  async getPublication(id: string) { return knowledgeRepository.getPublication(id); },
  async createPublication(data: any) { return knowledgeRepository.createPublication(data); },
  async updatePublication(id: string, data: any) { return knowledgeRepository.updatePublication(id, data); },
  async deletePublication(id: string) { return knowledgeRepository.deletePublication(id); },
  async getPublicationCount() { return knowledgeRepository.getPublicationCount(); },

  // Readiness
  async getReadiness() {
    const dashboard = await knowledgeRepository.getDashboard();
    return dashboard.readiness;
  },
};
