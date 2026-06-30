import { PrismaClient } from '@prisma/client'

export interface VerificationPolicyConfig {
  minimumDelta: number
  noiseThreshold: number
  minimumConfidence: string
  requireRevalidation: boolean
  maxRetries: number
}

export class VerificationPolicyService {
  constructor(private prisma: PrismaClient) {}

  async getEffectivePolicy(industry?: string, optimizationType?: string): Promise<VerificationPolicyConfig> {
    // Find best matching policy: industry + type > type only > default
    const policies = await this.prisma.verificationPolicy.findMany({
      where: { isActive: true },
      orderBy: [{ industry: 'desc' }, { optimizationType: 'desc' }, { priority: 'desc' }],
    })

    // Score each policy for match quality
    let bestMatch: any = null
    let bestScore = -1

    for (const p of policies) {
      let score = 0
      if (p.industry === industry) score += 10
      if (p.optimizationType === optimizationType) score += 5
      if (!p.industry && !p.optimizationType) score += 0 // default
      if (score > bestScore) {
        bestScore = score
        bestMatch = p
      }
    }

    if (!bestMatch) {
      return {
        minimumDelta: 1.0,
        noiseThreshold: 0.5,
        minimumConfidence: 'LOW',
        requireRevalidation: true,
        maxRetries: 3,
      }
    }

    return {
      minimumDelta: bestMatch.minimumDelta,
      noiseThreshold: bestMatch.noiseThreshold,
      minimumConfidence: bestMatch.minimumConfidence,
      requireRevalidation: bestMatch.requireRevalidation,
      maxRetries: bestMatch.maxRetries,
    }
  }

  async seedDefaultPolicy(): Promise<void> {
    const existing = await this.prisma.verificationPolicy.findFirst()
    if (existing) return

    await this.prisma.verificationPolicy.create({
      data: {
        minimumDelta: 1.0,
        noiseThreshold: 0.5,
        minimumConfidence: 'LOW',
        requireRevalidation: true,
        maxRetries: 3,
        isActive: true,
        priority: 0,
      },
    })
  }
}
