# ADR-010: Platform SDK — SDK 封装所有 Runtime，Workspace 不直接调用 Runtime

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: sdk, layering

## Context
ARCH-001 audit found that workspace code directly imported and called Runtime singletons. This created tight coupling between workspace and Runtime implementations, making it difficult to change Runtime APIs without breaking callers.

## Decision
Create `PlatformSDK` class in `platform/sdk/platform-sdk.ts` as the single entry point for all Runtime operations:

1. **PlatformSDK** encapsulates Asset, Semantic, Goal, and Capability services
2. Workspace code must import `platformSDK` and use `platformSDK.asset()`, `platformSDK.semantic()`, etc.
3. SDK methods accept optional `PlatformContext`
4. SDK is lazy-initialized on first use via `platformSDK.initialize()`
5. Runtime imports happen via dynamic import inside SDK, not static imports at module level

## Alternatives Considered
- **Direct Runtime import**: Current approach; defeats layering
- **Dependency injection container**: Over-engineered for current needs
- **GraphQL BFF**: Too heavy; SDK provides sufficient abstraction

## Consequences
- Workspace code no longer depends on Runtime implementation details
- Runtime API changes only require SDK adapter updates
- Lazy initialization avoids circular dependencies
- Context propagation is guaranteed through SDK methods
- Singleton pattern is preserved for simplicity

## Compliance
- All new workspace code must use PlatformSDK, not import Runtime directly
- Runtime singletons are still exported for backward compatibility
- SDK is the recommended path for all new consumers
