/**
 * P2 — StreamController（流控制）
 *
 * 防 IO 爆炸：chunk buffer、flow control、cancel stream。
 * 第一版为 stub，后续扩展带宽限流、merge stream。
 */

export class StreamController {
  wrap<T>(stream: AsyncIterable<T>, options?: {
    maxChunksPerSecond?: number
  }): {
    [Symbol.asyncIterator](): AsyncIterator<T>
    cancel(): void
  } {
    const iterator = stream[Symbol.asyncIterator]()
    let cancelled = false

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<T>> {
            if (cancelled) return { done: true, value: undefined as any }
            return iterator.next()
          },
        }
      },
      cancel() {
        cancelled = true
      },
    }
  }
}
