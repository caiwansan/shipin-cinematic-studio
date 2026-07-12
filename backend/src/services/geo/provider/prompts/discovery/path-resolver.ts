// ============================================================
// Cross-platform dirname helper
// RC2-T002: DeepSeek Discovery Provider
//
// Handles both CJS (__dirname) and ESM (import.meta.url) environments.
// ============================================================

import * as path from 'path'
import * as fs from 'fs'

/**
 * Resolve a file relative to the caller's directory, with fallbacks for
 * CJS (__dirname), ESM (import.meta.url), and tsx (process.cwd()).
 *
 * @param filenames - List of filenames to try (relative paths)
 * @param searchPaths - Additional search paths to try
 * @returns The content of the first found file, or null
 */
export function resolveFilePath(
  filenames: string[],
  searchPaths?: string[]
): string | null {
  const allPaths: string[] = []

  // Add search paths + CWD relative paths
  const dirs = searchPaths || [
    // Possible locations for the current directory
    process.cwd(),
  ]

  for (const dir of dirs) {
    for (const filename of filenames) {
      allPaths.push(path.join(dir, filename))
    }
  }

  // Also try process.cwd() relative
  for (const filename of filenames) {
    allPaths.push(path.join(process.cwd(), filename))
  }

  for (const p of allPaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8')
      }
    } catch {
      // Try next
    }
  }

  return null
}

/**
 * Find a file with fallback paths. Returns the first valid path or null.
 */
export function findFilePath(
  filenames: string[],
  searchPaths?: string[]
): string | null {
  const allPaths: string[] = []

  const dirs = searchPaths || [process.cwd()]

  for (const dir of dirs) {
    for (const filename of filenames) {
      allPaths.push(path.join(dir, filename))
    }
  }

  for (const filename of filenames) {
    allPaths.push(path.join(process.cwd(), filename))
  }

  for (const p of allPaths) {
    try {
      if (fs.existsSync(p)) {
        return p
      }
    } catch {
      // Try next
    }
  }

  return null
}

/**
 * List of paths to search for prompt/data files in order of priority.
 */
export function getPromptSearchPaths(relativeDir: string): string[] {
  return [
    // CJS runtime: relative to __dirname (if available)
    relativeDir,
    // tsx/dev: relative to project src
    path.join(process.cwd(), 'src', relativeDir),
    // Production: dist directory
    path.join(process.cwd(), 'dist', 'backend', 'src', relativeDir),
    // Additional fallback
    path.join(process.cwd(), relativeDir),
  ]
}
