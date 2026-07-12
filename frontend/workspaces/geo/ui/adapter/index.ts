/**
 * UI Adapter Layer
 *
 * Adapters bridge existing design-system and kmki-ui components to the @/ui interface.
 * This allows old page code to continue working while all new code uses @/ui imports.
 *
 * Adapters do NOT modify the original components. They only:
 * 1. Re-export with the GeoXxx naming convention
 * 2. Provide props compatibility mapping when needed
 */

export * from './design-system'
export * from './kmki-ui'
