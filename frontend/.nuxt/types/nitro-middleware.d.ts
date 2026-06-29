export type MiddlewareKey = "auth" | "deprecated-module-guard" | "route-guard"
declare module 'nitropack' {
  interface NitroRouteConfig {
    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>
  }
}