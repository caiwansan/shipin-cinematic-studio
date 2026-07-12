// ============================================================
// P0-B.4: PresenceRepository Unit Tests
//
// Mocks prisma.gEOPresenceEvidence. Tests creation, dedup,
// and project-based queries.
// ============================================================

import { presenceRepository } from '../presence.repository.js'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../utils/index')

const mockCreate = jest.fn()
const mockFindFirst = jest.fn()
const mockFindMany = jest.fn()
const mockCount = jest.fn()

beforeAll(() => {
  prisma.gEOPresenceEvidence = {
    create: mockCreate,
    findFirst: mockFindFirst,
    findMany: mockFindMany,
    count: mockCount,
  }
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PresenceRepository', () => {
  const sampleRecord = {
    id: 'ev-001',
    projectId: 'proj-1',
    provider: 'chatgpt',
    entity: 'Acme Corp',
    status: 'FOUND',
    confidence: 0.95,
    requestHash: 'abc123hash',
    source: 'provider:chatgpt',
    checkedAt: new Date('2025-01-01T00:00:00Z'),
    latencyMs: 120,
    metadata: { explain: 'Found on ChatGPT' },
    createdAt: new Date('2025-01-01T00:00:00Z'),
  }

  it('should create a presence evidence record', async () => {
    mockCreate.mockResolvedValue(sampleRecord)

    const result = await presenceRepository.create({
      projectId: 'proj-1',
      provider: 'chatgpt',
      entity: 'Acme Corp',
      status: 'FOUND',
      confidence: 0.95,
      requestHash: 'abc123hash',
      source: 'provider:chatgpt',
      checkedAt: new Date('2025-01-01T00:00:00Z'),
      latencyMs: 120,
      metadata: { explain: 'Found on ChatGPT' },
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        projectId: 'proj-1',
        provider: 'chatgpt',
        entity: 'Acme Corp',
        status: 'FOUND',
        confidence: 0.95,
        requestHash: 'abc123hash',
        source: 'provider:chatgpt',
        checkedAt: new Date('2025-01-01T00:00:00Z'),
        latencyMs: 120,
        metadata: { explain: 'Found on ChatGPT' },
      },
    })
    expect(result).toEqual(sampleRecord)
  })

  it('should detect duplicates by requestHash', async () => {
    mockFindFirst.mockResolvedValue(sampleRecord)

    const result = await presenceRepository.findRecentByHash('abc123hash', 24)

    expect(mockFindFirst).toHaveBeenCalledTimes(1)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        requestHash: 'abc123hash',
        checkedAt: { gte: expect.any(Date) },
      },
      orderBy: { checkedAt: 'desc' },
    })
    expect(result).toEqual(sampleRecord)
  })

  it('should return null when no duplicate found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await presenceRepository.findRecentByHash('nonexistent', 24)

    expect(result).toBeNull()
  })

  it('should find latest records by project', async () => {
    const records = [sampleRecord]
    mockFindMany.mockResolvedValue(records)

    const result = await presenceRepository.findLatestByProject('proj-1', 10)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1' },
      orderBy: { checkedAt: 'desc' },
      take: 10,
    })
    expect(result).toEqual(records)
  })

  it('should count records for a project', async () => {
    mockCount.mockResolvedValue(5)

    const result = await presenceRepository.countByProject('proj-1')

    expect(mockCount).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } })
    expect(result).toBe(5)
  })

  it('should handle empty project results', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await presenceRepository.findLatestByProject('empty-proj')

    expect(result).toEqual([])
  })
})
