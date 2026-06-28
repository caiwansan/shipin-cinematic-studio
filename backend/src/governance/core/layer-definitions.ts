export enum SystemLayer {
  ROUTE = 'route',
  SERVICE = 'service',
  RUNTIME = 'runtime',
  CONTRACT = 'contract',
  HYBRID = 'hybrid',
}

export interface LayerConstraint {
  canReturn: string[];
  canImport: string[];
  forbidden: string[];
}

export const LayerRules: Record<SystemLayer, LayerConstraint> = {
  [SystemLayer.ROUTE]: {
    canReturn: ['ApiResponse<any>'],
    canImport: ['service', 'contracts'],
    forbidden: ['runtime direct return', 'raw domain return without wrapper'],
  },
  [SystemLayer.SERVICE]: {
    canReturn: ['domain object ONLY'],
    canImport: ['prisma', 'utils', 'external sdk'],
    forbidden: ['ApiResponse', 'fastify reply', 'route logic'],
  },
  [SystemLayer.RUNTIME]: {
    canReturn: ['execution result ONLY'],
    canImport: ['model-adapters', 'queue'],
    forbidden: ['ApiResponse', 'route logic', 'service orchestration'],
  },
  [SystemLayer.CONTRACT]: {
    canReturn: ['type definition ONLY'],
    canImport: [],
    forbidden: ['any runtime import', 'business logic'],
  },
  [SystemLayer.HYBRID]: {
    canReturn: ['ApiResponse<any>', 'domain object'],
    canImport: ['service', 'contracts', 'prisma', 'runtime'],
    forbidden: [],
  },
};
