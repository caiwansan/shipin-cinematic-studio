// ════════════════════════════════════════════════════════════
// KDP K3 — Repository: DeliveryTargetRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { DeliveryTargetType } from '../../../types'

export class DeliveryTargetRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    type: string
    name: string
    config: Record<string, any>
  }): Promise<DeliveryTargetType> {
    const target = await this.prisma.deliveryTarget.create({
      data: {
        type: data.type,
        name: data.name,
        config: data.config,
        enabled: true,
      },
    })
    return this.toDTO(target)
  }

  async findById(id: string): Promise<DeliveryTargetType | null> {
    const t = await this.prisma.deliveryTarget.findUnique({ where: { id } })
    return t ? this.toDTO(t) : null
  }

  async findByType(type: string): Promise<DeliveryTargetType[]> {
    const targets = await this.prisma.deliveryTarget.findMany({
      where: { type, enabled: true },
    })
    return targets.map(t => this.toDTO(t))
  }

  async getDefaultLocalTarget(): Promise<DeliveryTargetType | null> {
    const target = await this.prisma.deliveryTarget.findFirst({
      where: { type: 'local', enabled: true },
    })
    return target ? this.toDTO(target) : null
  }

  async ensureLocalTarget(outputPath: string): Promise<DeliveryTargetType> {
    const existing = await this.getDefaultLocalTarget()
    if (existing) return existing
    return this.create({
      type: 'local',
      name: 'Local Sandbox',
      config: { outputPath },
    })
  }

  private toDTO(t: any): DeliveryTargetType {
    return {
      id: t.id,
      type: t.type,
      name: t.name,
      config: typeof t.config === 'object' ? t.config : JSON.parse(t.config || '{}'),
      enabled: t.enabled,
      createdAt: t.createdAt.toISOString(),
    }
  }
}
