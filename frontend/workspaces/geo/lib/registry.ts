/**
 * Registry — 统一注册表接口
 *
 * 所有 Registry 都应该实现这个接口，确保团队开发时 API 一致。
 */
export interface Registry<T> {
  /** 注册一个条目 */
  register(key: string, value: T): void
  /** 注销一个条目 */
  unregister(key: string): void
  /** 根据 key 查找条目 */
  resolve(key: string): T | undefined
  /** 是否已注册 */
  has(key: string): boolean
  /** 列出所有已注册的 key */
  list(): string[]
}

/**
 * createRegistry — 快速创建一个 Registry 实例
 */
export function createRegistry<T>(defaults: Record<string, T> = {}): Registry<T> {
  const store = new Map(Object.entries(defaults))

  return {
    register(key: string, value: T) {
      store.set(key, value)
    },
    unregister(key: string) {
      store.delete(key)
    },
    resolve(key: string) {
      return store.get(key)
    },
    has(key: string) {
      return store.has(key)
    },
    list() {
      return Array.from(store.keys())
    },
  }
}
