// preload.mjs
// Preload hook: registers @platform alias before any module resolution
// Used via: node --import ./preload.mjs <app>
// Or via PM2: --node-args="--import ./preload.mjs"

import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Register module alias for @platform → <project-root>/platform
const moduleAlias = require('module-alias')
const platformPath = path.resolve(__dirname, '..', 'platform')
moduleAlias.addAlias('@platform', platformPath)
console.log(`[preload] @platform → ${platformPath}`)
