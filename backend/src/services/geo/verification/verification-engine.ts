import { PrismaClient } from '@prisma/client';
import { PrismaVerificationRepository } from './verification.repository';
import { InMemoryJobRunner } from './verification-job-runner';
import { SnapshotService } from './snapshot.service';
import { VerificationPolicyService } from './verification-policy.service';
import { eventBus } from '../../../platform/event-bus';
import type { VerificationRequest, CompareResult, EvidenceRecord } from './verification.types';
import type { OptimizationExecutionDTO, VerificationResultDTO } from '../../../platform/contracts/verification.contract';

export class VerificationEngine {
  private repository: PrismaVerificationRepository;
  private jobRunner: InMemoryJobRunner;
  private snapshotService: SnapshotService;
  private policyService?: VerificationPolicyService;

  constructor(
    private prisma: PrismaClient,
    jobRunner?: InMemoryJobRunner,
    repository?: PrismaVerificationRepository,
    policyService?: VerificationPolicyService,
  ) {
    this.repository = repository || new PrismaVerificationRepository(prisma);
    this.jobRunner = jobRunner || new InMemoryJobRunner();
    this.snapshotService = new SnapshotService(prisma);
    this.policyService = policyService;

    // Wire up execution callback
    this.jobRunner.setExecutionCallback(async (executionId) => {
      await this.executeVerification(executionId);
    });
  }

  /**
   * Submit an execution for verification
   */
  async submit(request: VerificationRequest): Promise<{ executionId: string; jobStatus: string }> {
    // Get effective policy for this submission
    let policyConfig = {
      minimumDelta: 1.0,
      noiseThreshold: 0.5,
      minimumConfidence: 'LOW',
      requireRevalidation: true,
      maxRetries: 3,
    };

    if (this.policyService) {
      policyConfig = await this.policyService.getEffectivePolicy(undefined, request.optimizationType);
    }

    // 1. Create execution record (use explicit executionId for idempotency)
    const execution = await this.repository.createExecution({
      id: request.executionId,
      projectId: request.projectId,
      optimizationType: request.optimizationType,
      executionStatus: 'pending',
      triggerSource: request.triggerSource || 'manual',
    });

    // 2. Create before-snapshot (score before optimization)
    const beforeSnapshot = await this.snapshotService.createSnapshot(request.projectId, execution.id);

    // 3. Update execution with before snapshot info
    await this.repository.updateExecution(execution.id, {
      beforeSnapshotId: beforeSnapshot.id,
      beforeScore: beforeSnapshot.score,
      beforeDimensions: beforeSnapshot.dimensions,
    });

    // 4. Enqueue job (idempotent)
    const job = await this.jobRunner.enqueue(execution.id);

    // 5. Publish event
    await eventBus.publish({
      type: 'verification.submitted',
      source: 'VerificationEngine',
      payload: { executionId: execution.id, projectId: request.projectId },
    });

    return { executionId: execution.id, jobStatus: job.status };
  }

  /**
   * Execute the actual verification
   */
  private async executeVerification(executionId: string): Promise<void> {
    const execution = await this.repository.getExecution(executionId);
    if (!execution) throw new Error(`Execution ${executionId} not found`);

    // Update job to running
    const job = await this.repository.getJobByExecutionId(executionId);
    if (job) {
      await this.repository.updateJob(job.id, { status: 'running', startedAt: new Date() });
    }
    await this.repository.updateExecution(executionId, { executionStatus: 'running' });

    try {
      // Create after-snapshot (score after optimization) using GeoScorer integration
      const afterSnapshot = await this.snapshotService.createSnapshot(execution.projectId, executionId);

      const beforeScore = execution.beforeScore || 0;
      const afterScore = afterSnapshot.score;
      const delta = afterScore - beforeScore;

      // Get policy to determine significance
      const policy = this.policyService
        ? await this.policyService.getEffectivePolicy(undefined, execution.optimizationType)
        : {
            minimumDelta: 1.0,
            noiseThreshold: 0.5,
            minimumConfidence: 'LOW',
            requireRevalidation: true,
            maxRetries: 3,
          };

      const isSignificant = Math.abs(delta) >= policy.minimumDelta;
      const isImprovement = delta > 0 && isSignificant;
      const verificationStatus = isImprovement ? 'verified' : (isSignificant ? 'failed' : 'skipped');

      // Build evidence from dimension deltas
      const beforeDimMap = (execution.beforeDimensions || {}) as Record<string, any>;
      const afterDimMap = (afterSnapshot.dimensions || {}) as Record<string, any>;
      const evidence: EvidenceRecord[] = [];
      const changedDimensions: string[] = [];
      const dimensionKeys = ['visibility', 'authority', 'content', 'website', 'knowledge'];

      for (const dim of dimensionKeys) {
        const beforeDimValue = beforeDimMap[dim]?.score || 0;
        const afterDimValue = afterDimMap[dim]?.score || 0;
        const dimDelta = afterDimValue - beforeDimValue;

        if (Math.abs(dimDelta) >= policy.noiseThreshold) {
          changedDimensions.push(dim);
        }

        evidence.push({
          dimension: dim,
          before: beforeDimValue,
          after: afterDimValue,
          delta: dimDelta,
          status: dimDelta > 0 ? 'improved' : (dimDelta < 0 ? 'declined' : 'unchanged'),
          confidence: policy.minimumConfidence,
          reason: dimDelta >= policy.minimumDelta
            ? `Significant ${dimDelta > 0 ? 'improvement' : 'decline'} after optimization`
            : 'Within noise threshold',
        });
      }

      // Update execution with results
      await this.repository.updateExecution(executionId, {
        executionStatus: 'completed',
        afterSnapshotId: afterSnapshot.id,
        afterScore,
        scoreDelta: delta,
        changedDimensions,
        afterDimensions: afterSnapshot.dimensions,
        verificationVersion: 'v1.0',
        geoScoreVersion: 'v1.0',
        completedAt: new Date(),
        verifiedAt: new Date(),
        verificationStatus,
      });

      // Create verification result
      await this.repository.createResult({
        projectId: execution.projectId,
        executionId,
        isImprovement,
        deltaWhenVerified: delta,
        rawEvidence: { evidence },
        details: {
          optimizationType: execution.optimizationType,
          triggerSource: execution.triggerSource,
          policyThreshold: policy.minimumDelta,
          noiseThreshold: policy.noiseThreshold,
          isSignificant,
        },
      });

      // Update job to completed
      if (job) {
        await this.repository.updateJob(job.id, { status: 'completed', completedAt: new Date() });
        this.jobRunner.updateState(executionId, { status: 'completed', completedAt: new Date() });
      }

      // Publish completion event
      await eventBus.publish({
        type: 'verification.completed',
        source: 'VerificationEngine',
        payload: { executionId, projectId: execution.projectId, delta, isImprovement, evidence, verificationStatus },
      });

    } catch (error: any) {
      // Mark as failed
      await this.repository.updateExecution(executionId, { executionStatus: 'failed' });
      if (job) {
        await this.repository.updateJob(job.id, { status: 'failed', lastError: error.message, completedAt: new Date() });
        this.jobRunner.updateState(executionId, { status: 'failed', lastError: error.message, completedAt: new Date() });
      }

      await eventBus.publish({
        type: 'verification.failed',
        source: 'VerificationEngine',
        payload: { executionId, projectId: execution.projectId, error: error.message },
      });
    }
  }

  /**
   * Get verification result
   */
  async getResult(executionId: string): Promise<VerificationResultDTO | null> {
    return this.repository.getResult(executionId);
  }

  /**
   * Compare two executions
   */
  async compare(beforeExecutionId: string, afterExecutionId: string): Promise<CompareResult | null> {
    const compareDTO = await this.repository.compare(beforeExecutionId, afterExecutionId);
    if (!compareDTO) return null;

    // Build evidence from compare
    const evidence: EvidenceRecord[] = compareDTO.changedDimensions.map(dim => ({
      dimension: dim,
      before: (compareDTO.beforeDimensions as any)?.[dim] || 0,
      after: (compareDTO.afterDimensions as any)?.[dim] || 0,
      delta: ((compareDTO.afterDimensions as any)?.[dim] || 0) - ((compareDTO.beforeDimensions as any)?.[dim] || 0),
      status: (((compareDTO.afterDimensions as any)?.[dim] || 0) > ((compareDTO.beforeDimensions as any)?.[dim] || 0)) ? 'improved' : 'declined',
      confidence: 'MEDIUM',
    }));

    return {
      beforeExecutionId,
      afterExecutionId,
      beforeScore: compareDTO.beforeScore,
      afterScore: compareDTO.afterScore,
      delta: compareDTO.delta,
      beforeDimensions: compareDTO.beforeDimensions,
      afterDimensions: compareDTO.afterDimensions,
      changedDimensions: compareDTO.changedDimensions,
      evidence,
      verificationVersion: compareDTO.verificationVersion,
      geoScoreVersion: compareDTO.geoScoreVersion,
    };
  }

  /**
   * Get history for a project
   */
  async getHistory(projectId: string, limit = 20, offset = 0): Promise<import('../../../platform/contracts/verification.contract').VerificationHistoryDTO[]> {
    return this.repository.findHistory(projectId, limit, offset);
  }

  /**
   * Get job status
   */
  async getJobStatus(executionId: string): Promise<string> {
    return this.jobRunner.getStatus(executionId);
  }

  // Expose repository for service layer
  getRepository(): PrismaVerificationRepository { return this.repository; }

  // Expose snapshot service for direct use
  getSnapshotService(): SnapshotService { return this.snapshotService; }
}
