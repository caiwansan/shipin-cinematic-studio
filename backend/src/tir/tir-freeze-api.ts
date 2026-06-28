/**
 * TIR Semantic Freeze — API
 */

import { handleFreezeStatus } from './semantic-freeze/freeze-harness.js'

export function handleTIRFreezeStatus() {
  return handleFreezeStatus()
}
