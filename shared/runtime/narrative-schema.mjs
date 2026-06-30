// ESM wrapper for narrative-schema (which is CommonJS .js)
import narrativeSchema from './narrative-schema.js'
export const {
  generateNarrativeId,
  toNull,
  toNullStrict,
  toNullArray,
  safeArray,
} = narrativeSchema
export default narrativeSchema
