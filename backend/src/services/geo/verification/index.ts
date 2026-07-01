// ============================================================
// P0-T006: Verification Module — Entry Point
// ============================================================

export { VerificationEngine } from './engine';
export { generateClaims } from './claim-generator';
export { buildEvidenceTimeline } from './evidence-timeline';
export type {
  VerificationResult,
  VerificationClaim,
  VerificationEvidence,
  VerificationHistoryEntry,
  VerificationRunRequest,
} from './types';
export {
  evidenceGradeToNumber,
  numberToEvidenceGrade,
  generateVerificationId,
} from './types';

// Singleton
import { PrismaClient } from '@prisma/client';
import { VerificationEngine } from './engine';

let _instance: VerificationEngine | null = null;

export function getVerificationEngine(prisma?: PrismaClient): VerificationEngine {
  if (!_instance) {
    const client = prisma || new PrismaClient();
    _instance = new VerificationEngine(client);
  }
  return _instance;
}
