/**
 * Volcengine Proxy Factory — Phase 1A
 *
 * Creates transparent Proxy for volcengine provider objects.
 * Only responsibility: intercep + metadata tag.
 * No behavior changes, no scoring, no registry.
 */

// Type definitions for ProxyHandler (not available via ES2022 target without DOM lib)
type ProxyHandler<T> = {
  get?(target: T, prop: string | symbol, receiver: any): any
  set?(target: T, prop: string | symbol, value: any, receiver: any): boolean
  apply?(target: any, thisArg: any, argArray: any[]): any
}

export interface ProxyMeta {
  provider: 'volcengine'
  symbol: string          // e.g. 'volcengineImage', 'volcengineVideo', 'volcengineTTS'
  mode: 'job' | 'stateless'
  wrapper: 'v1-proxy'
}

export type WithMeta<T> = T & { __meta?: ProxyMeta }

export function createVolcengineProxy<T extends Record<string, any>>(
  target: T,
  meta: ProxyMeta,
): T {
  const handler: ProxyHandler<T> = {
    get(obj, prop) {
      const value = (obj as any)[prop]

      // Intercept function calls to tag return value with meta
      if (typeof value === 'function') {
        return new Proxy(value, {
          apply(fn, thisArg, args) {
            const result = fn.apply(thisArg, args)
            // If result is a Promise, tag after resolution
            if (result instanceof Promise) {
              return result.then((res) => {
                if (res && typeof res === 'object' && !res.__meta) {
                  (res as any).__meta = meta
                }
                return res
              })
            }
            // Sync result
            if (result && typeof result === 'object' && !result.__meta) {
              (result as any).__meta = meta
            }
            return result
          },
        })
      }

      return value
    },
  }

  return new Proxy(target, handler)
}
