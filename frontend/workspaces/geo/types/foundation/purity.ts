/**
 * Foundation Component Purity Constraint
 *
 * Foundation Components MUST NOT import:
 * - Any business component (HealthCard, MissionCard, RecommendationCard, etc.)
 * - Any AI component (ExplainDrawer, AIResult, etc.)
 * - Vue Router
 * - Pinia Store
 * - Any service class
 * - Any API client
 *
 * Foundation Components MAY import:
 * - Vue (defineComponent, ref, computed, etc.)
 * - Foundation types (./types/foundation/*)
 * - Other Foundation components (same directory or foundation/)
 * - CSS/SCSS
 * - vue-i18n (if internationalized)
 *
 * Violation scan: `grep -r "import.*from.*@/services\|import.*from.*@/stores\|import.*from.*@/workspaces/geo/components/" frontend/workspaces/geo/components/foundation/`
 */
export const FOUNDATION_PURITY_CONSTRAINT = 'Foundation components must not depend on non-foundation modules'
