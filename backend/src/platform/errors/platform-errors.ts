// ============================================================
// platform-errors — Export compatibility shim
// Created 2026-07-05 by Release Gate to fix missing module
// ============================================================

export class RepositoryError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export function isRepositoryError(err: unknown): err is RepositoryError {
  return err instanceof RepositoryError
}
