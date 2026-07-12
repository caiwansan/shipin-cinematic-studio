// AI Knowledge Hub — API Routes
// Fastify 风格路由

import type { FastifyInstance } from 'fastify';
import { knowledgeService } from '../application/service';
import { compileKnowledgePackage, getJsonLdData, getPromptData } from '../compiler/index';
import { createSnapshot, getLatestSnapshot, getSnapshot, listSnapshots } from '../compiler/snapshot';
import type { CompileOptions } from '../compiler/index';

export default async function knowledgeHubRoutes(app: FastifyInstance) {
  // ── Dashboard ──
  app.get('/dashboard', async (_req, reply) => {
    try {
      const data = await knowledgeService.getDashboard();
      return data;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch dashboard' });
    }
  });

  // ── Brand ──
  app.get('/brands', async (_req, reply) => {
    try {
      return await knowledgeService.getBrands();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch brands' });
    }
  });

  app.get('/brands/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const brand = await knowledgeService.getBrand(id);
      if (!brand) return reply.status(404).send({ error: 'Brand not found' });
      return brand;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch brand' });
    }
  });

  app.post('/brands', async (req, reply) => {
    try {
      const brand = await knowledgeService.createBrand(req.body as any);
      return reply.status(201).send(brand);
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to create brand' });
    }
  });

  app.put('/brands/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const brand = await knowledgeService.updateBrand(id, req.body as any);
      return brand;
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to update brand' });
    }
  });

  app.delete('/brands/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await knowledgeService.deleteBrand(id);
      return { success: true };
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to delete brand' });
    }
  });

  // ── Product ──
  app.get('/products', async (_req, reply) => {
    try {
      return await knowledgeService.getProducts();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch products' });
    }
  });

  app.get('/products/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const product = await knowledgeService.getProduct(id);
      if (!product) return reply.status(404).send({ error: 'Product not found' });
      return product;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch product' });
    }
  });

  app.post('/products', async (req, reply) => {
    try {
      const product = await knowledgeService.createProduct(req.body as any);
      return reply.status(201).send(product);
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to create product' });
    }
  });

  app.put('/products/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const product = await knowledgeService.updateProduct(id, req.body as any);
      return product;
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to update product' });
    }
  });

  app.delete('/products/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await knowledgeService.deleteProduct(id);
      return { success: true };
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to delete product' });
    }
  });

  // ── Article / Knowledge ──
  app.get('/articles', async (_req, reply) => {
    try {
      return await knowledgeService.getArticles();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch articles' });
    }
  });

  app.get('/articles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const article = await knowledgeService.getArticle(id);
      if (!article) return reply.status(404).send({ error: 'Article not found' });
      return article;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch article' });
    }
  });

  app.post('/articles', async (req, reply) => {
    try {
      const article = await knowledgeService.createArticle(req.body as any);
      return reply.status(201).send(article);
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to create article' });
    }
  });

  app.put('/articles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const article = await knowledgeService.updateArticle(id, req.body as any);
      return article;
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to update article' });
    }
  });

  app.delete('/articles/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await knowledgeService.deleteArticle(id);
      return { success: true };
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to delete article' });
    }
  });

  // ── Entity ──
  app.get('/entities', async (_req, reply) => {
    try {
      return await knowledgeService.getEntities();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch entities' });
    }
  });

  app.get('/entities/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entity = await knowledgeService.getEntity(id);
      if (!entity) return reply.status(404).send({ error: 'Entity not found' });
      return entity;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch entity' });
    }
  });

  app.post('/entities', async (req, reply) => {
    try {
      const entity = await knowledgeService.createEntity(req.body as any);
      return reply.status(201).send(entity);
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to create entity' });
    }
  });

  app.put('/entities/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entity = await knowledgeService.updateEntity(id, req.body as any);
      return entity;
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to update entity' });
    }
  });

  app.delete('/entities/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await knowledgeService.deleteEntity(id);
      return { success: true };
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to delete entity' });
    }
  });

  // ── Publication ──
  app.get('/publications', async (_req, reply) => {
    try {
      return await knowledgeService.getPublications();
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch publications' });
    }
  });

  app.get('/publications/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const publication = await knowledgeService.getPublication(id);
      if (!publication) return reply.status(404).send({ error: 'Publication not found' });
      return publication;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch publication' });
    }
  });

  app.post('/publications', async (req, reply) => {
    try {
      const publication = await knowledgeService.createPublication(req.body as any);
      return reply.status(201).send(publication);
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to create publication' });
    }
  });

  app.put('/publications/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const publication = await knowledgeService.updatePublication(id, req.body as any);
      return publication;
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to update publication' });
    }
  });

  app.delete('/publications/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await knowledgeService.deletePublication(id);
      return { success: true };
    } catch (err) {
      return reply.status(400).send({ error: 'Failed to delete publication' });
    }
  });

  // ── Readiness ──
  app.get('/readiness', async (_req, reply) => {
    try {
      const dashboard = await knowledgeService.getDashboard();
      return dashboard.readiness;
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to fetch readiness' });
    }
  });

  // ── Knowledge Package (via Compiler) ──────────────────────────────────

  // GET /package — 获取完整知识包
  app.get('/package', async (_request, reply) => {
    try {
      const options: CompileOptions = {
        version: '1.0.0',
        includeProducts: true,
        includeArticles: true,
        includeEntities: true,
        includePublications: true,
      };
      const result = await compileKnowledgePackage(options);
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to compile package' });
    }
  });

  // GET /package/:type — 获取指定类型子包
  app.get('/package/:type', async (request, reply) => {
    try {
      const { type } = request.params as { type: string };
      const validTypes = ['brands', 'products', 'entities'];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({ success: false, error: `Invalid type: ${type}. Valid types: ${validTypes.join(', ')}` });
      }
      const result = await compileKnowledgePackage({ version: '1.0.0' });
      return { success: true, data: (result.data as any)[type] || [] };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch package type' });
    }
  });

  // ── JSON-LD (via Compiler) ────────────────────────────────────────────

  // GET /jsonld — 获取完整 JSON-LD 图谱
  app.get('/jsonld', async (_request, reply) => {
    try {
      const data = await getJsonLdData();
      return { success: true, data };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch JSON-LD data' });
    }
  });

  // GET /jsonld/:type — 获取指定类型 JSON-LD
  app.get('/jsonld/:type', async (request, reply) => {
    try {
      const { type } = request.params as { type: string };
      const validTypes = ['organization', 'products', 'articles', 'faq', 'full'];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({ success: false, error: `Invalid JSON-LD type: ${type}. Valid types: ${validTypes.join(', ')}` });
      }
      const data = await getJsonLdData();
      return { success: true, data: (data as any)[type] || null };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch JSON-LD type' });
    }
  });

  // ── Prompt (via Compiler) ─────────────────────────────────────────────

  // GET /prompt — 获取所有 Prompt Block
  app.get('/prompt', async (_request, reply) => {
    try {
      const data = await getPromptData();
      return { success: true, data };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch prompt data' });
    }
  });

  // ── Snapshot (via Compiler) ───────────────────────────────────────────

  // GET /snapshot — 获取最新或所有快照
  app.get('/snapshot', async (_request, reply) => {
    try {
      const latest = await getLatestSnapshot();
      if (latest) {
        return { success: true, data: latest };
      }
      // 如果没有快照，先创建一个
      const snapshot = await createSnapshot();
      return { success: true, data: snapshot };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch snapshot' });
    }
  });

  // GET /snapshot/:version — 获取指定版本快照
  app.get('/snapshot/:version', async (request, reply) => {
    try {
      const { version } = request.params as { version: string };
      const snapshot = await getSnapshot(version);
      if (!snapshot) {
        return reply.status(404).send({ success: false, error: `Snapshot not found: ${version}` });
      }
      return { success: true, data: snapshot };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to fetch snapshot' });
    }
  });

  // GET /snapshots — 列出所有快照
  app.get('/snapshots', async (_request, reply) => {
    try {
      const snapshots = await listSnapshots();
      return { success: true, data: snapshots };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to list snapshots' });
    }
  });

  // ── Export (via Compiler) ─────────────────────────────────────────────

  // GET /export — 导出知识包
  app.get('/export', async (_request, reply) => {
    try {
      const result = await compileKnowledgePackage();
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Failed to export package' });
    }
  });

}