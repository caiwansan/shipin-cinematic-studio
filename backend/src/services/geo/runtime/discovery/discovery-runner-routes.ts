import { FastifyInstance } from 'fastify';
import { runDiscovery, listRecentReplays } from './discovery-runner';
import { executionEngine } from './legacy-execution-engine';
import { DeepSeekProvider } from './legacy-deepseek-adapter';
import { geoCredentialProvider } from '../../presence/geo-credential-provider.js';

// Register providers (first load only)
let initialized = false;
function ensureProviders() {
  if (initialized) return;

  executionEngine.registerProvider('deepseek', new DeepSeekProvider('deepseek-v4-flash'));
  executionEngine.registerProvider('deepseek-deepseek-v4-flash', new DeepSeekProvider('deepseek-v4-flash'));
  executionEngine.registerProvider('deepseek-deepseek-v4-pro', new DeepSeekProvider('deepseek-v4-pro'));

  initialized = true;
}

export async function discoveryRunnerRoutes(app: FastifyInstance): Promise<void> {
  ensureProviders();

  // Get default discovery config
  app.get('/discovery/config', async (_request, reply) => {
    return {
      success: true,
      data: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    };
  });

  // Trigger one-time discovery scan
  app.get('/discovery/run', async (request, reply) => {
    try {
      const query = request.query as { provider?: string; model?: string; brandId?: string };
      const providerName = query.provider || 'deepseek';
      const modelName = query.model;

      let actualProvider = providerName;
      if (modelName) {
        const compositeKey = `${providerName}-${modelName}`;
        if (executionEngine.getProvider(compositeKey)) {
          actualProvider = compositeKey;
        } else if (executionEngine.getProvider(providerName)) {
          actualProvider = providerName;
        } else {
          return reply.code(400).send({
            success: false,
            error: `Provider '${providerName}' with model '${modelName}' not available`,
          });
        }
      } else if (!executionEngine.getProvider(providerName)) {
        return reply.code(400).send({
          success: false,
          error: `Provider '${providerName}' not registered`,
        });
      }

      let credential: { apiKey: string; baseURL?: string } | undefined
      try {
        credential = await geoCredentialProvider.resolve('anonymous', providerName)
      } catch {
        // No credentials — executionEngine will return explicit error
      }

      const executeOptions: any = {}
      if (modelName) executeOptions.model = modelName
      if (credential) {
        executeOptions.apiKey = credential.apiKey
        executeOptions.baseURL = credential.baseURL
      }

      const result = await runDiscovery({
        provider: actualProvider,
        model: modelName,
        brandId: query.brandId,
        executeOptions,
      });
      return {
        success: true,
        data: {
          replayId: result.replayId,
          provider: actualProvider,
          model: result.trace?.model || modelName,
          findingCount: result.result.findings.length,
          confidence: result.result.confidence,
          summary: result.result.summary,
          metrics: {
            duration: result.result.metrics?.duration,
            tokenCount: result.result.metrics?.tokenCount,
            cost: result.result.metrics?.cost,
          },
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
