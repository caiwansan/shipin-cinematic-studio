import { FastifyInstance } from 'fastify';
import assetEconomyRoutes from './asset-economy.routes.js';

/**
 * 注册资产经济系统路由
 */
export function registerAssetEconomyRoutes(app: FastifyInstance) {
  return app.register(assetEconomyRoutes);
}
