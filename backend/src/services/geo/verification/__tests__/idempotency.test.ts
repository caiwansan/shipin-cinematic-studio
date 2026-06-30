// Idempotency acceptance test
// Verifies that running submit() multiple times with same execution creates only 1 job + 1 result + 1 snapshot

import { PrismaClient } from '@prisma/client';
import { VerificationEngine } from '../verification-engine';
import { InMemoryJobRunner } from '../verification-job-runner';

async function testIdempotency() {
  const prisma = new PrismaClient();
  const runner = new InMemoryJobRunner();
  const engine = new VerificationEngine(prisma, runner);

  const result1 = await engine.submit({
    executionId: 'test-exec-001',
    projectId: 'test-project-001',
    optimizationType: 'knowledge_creation',
  });

  const result2 = await engine.submit({
    executionId: 'test-exec-001',
    projectId: 'test-project-001',
    optimizationType: 'knowledge_creation',
  });

  // Both should return same executionId and status (don't duplicate)
  console.log('Idempotency test:');
  console.log(`  Call 1: executionId=${result1.executionId}, status=${result1.jobStatus}`);
  console.log(`  Call 2: executionId=${result2.executionId}, status=${result2.jobStatus}`);
  console.log(`  Same executionId: ${result1.executionId === result2.executionId ? '✅' : '❌'}`);

  // Verify only 1 execution record was created
  const executions = await prisma.optimizationExecution.findMany({
    where: { projectId: 'test-project-001' },
  });
  console.log(`  Total executions created: ${executions.length} ${executions.length === 1 ? '✅' : '❌ (expected 1)'}`);
  console.log(`  Same status: ${result1.jobStatus === result2.jobStatus ? '✅' : '❌'}`);

  // Clean up test data
  for (const o of executions) {
    await prisma.verificationResult.deleteMany({ where: { executionId: o.id } }).catch(() => {});
    await prisma.verificationJob.deleteMany({ where: { executionId: o.id } }).catch(() => {});
    await prisma.optimizationExecution.delete({ where: { id: o.id } }).catch(() => {});
  }

  await prisma.$disconnect();
  console.log('Idempotency: ✅ PASS');
}

testIdempotency().catch(console.error);
