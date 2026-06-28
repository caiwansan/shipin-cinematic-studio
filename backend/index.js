// Shim: redirect to the actual compiled entry point
// The tsconfig outputs to dist/backend/src/ due to rootDir inference
require('./dist/backend/src/index.js')
