/**
 * world-interface/index.ts — Phase A-4
 *
 * 统一导出
 */

export { createEntity, cloneEntity } from './world-entity.js'
export type { WorldEntity } from './world-entity.js'

export { SamplingMethod, createWorldSignal } from './world-signal.js'
export type { WorldSignal, SignalValue } from './world-signal.js'

export { BiasType, createWorldView, detectBiases } from './world-view.js'
export type { WorldView, BiasDeclaration } from './world-view.js'

export { createEntityRegistry, entityRegistry } from './entity-registry.js'
export type { EntityRegistry, EntityTypeDef, EntityAttributeDef } from './entity-registry.js'

export { createWorldViewFactory, worldViewFactory } from './world-view-factory.js'
export type { WorldViewFactory, RawDataEntry, ViewFactoryParams } from './world-view-factory.js'

export { createWorldInterface } from './world-interface.js'
export type { WorldInterface, WorldInterfaceConfig } from './world-interface.js'
