/**
 * Phase 3A/B — Stream Plane barrel export
 */

export { StreamChunkFactory } from './stream-chunk.js'
export type {
  StreamChunk,
  StreamChunkType,
  StreamSession,
  StreamStatus,
  StreamRequest,
  StreamResult,
} from './stream-chunk.js'

export { StreamEventBus, globalStreamBus } from './stream-event-bus.js'

export { CAPABILITY_PLANE_MAP, getPlaneForCapability } from './planes.js'
export type { PlaneType, CapabilityBinding } from './planes.js'

export { StreamPlane, streamPlane } from './stream-plane.js'
