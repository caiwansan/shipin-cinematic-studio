/**
 * Kunlun Knowledge Hub — 统一入口
 * 
 * 昆仑镜知识操作系统，职业知识域为第一个行业域。
 * 未来可扩展：法律、音乐、GEO、新媒体、广告、小说创作...
 * 
 * 架构：
 *   Agent → Knowledge OS → Tool Router → LLM Gateway
 */

// ─── Canonical Schemas（Phase 3-A） ───
export * from './canonical/schemas'

// ─── Tool Registry（Phase 3-A） ───
export * from './registry/tool-registry'

// ─── Knowledge Engine（Phase 3-C） ───
export * from './engine/knowledge-engine'

// ─── Memory Engine（Phase 3-D） ───
export * from './memory/memory-engine'

// ─── LLM Gateway（Phase 3-E） ───
export * from './gateway/llm-gateway'

// ─── 版本信息 ───
export const KH_VERSION = '0.1.0'
export const KH_PHASE = 'Phase 3-A: Schema Freeze'
export const KH_DOMAIN = 'career'
