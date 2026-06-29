/**
 * EntityMetrics — benchmark metrics calculator for GEO Entity Discovery
 *
 * Measures: entity/relation counts, type coverage, recall, duplicate rate,
 * runtime, token usage, estimated cost, schema error rate.
 */

export interface EntityMetrics {
  sampleId: string
  entityCount: number
  relationCount: number
  entityTypes: string[]
  typeCoverage: number        // 0-100, coverage of expected_entity_types
  expectedFound: number       // fuzzy-matched expected_primary_entities
  expectedTotal: number       // total expected_primary_entities
  duplicateRate: number       // same-name entities / entityCount
  runtimeMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number       // USD
  schemaErrorRate: number     // 0 = ok, 1 = schema/parse error
}

/**
 * Calculate metrics from a sample definition and an API response result.
 *
 * @param sample  – the dataset sample (contains expected_primary_entities, expected_entity_types, etc.)
 * @param result  – the parsed JSON body from POST /api/geo/projects/:id/discover
 * @param usage   – optional usage info { runtimeMs, promptTokens, completionTokens, totalTokens }
 */
export function calculateMetrics(
  sample: any,
  result: any,
  usage?: any,
): EntityMetrics {
  const sampleId: string = sample.id ?? 'unknown'

  // --- Extract output ---
  // API response: { success: true, data: { entities: [...], relations: [...] } }
  // Agent result: { success: true, output: { entities: [...], relations: [...] } }
  const data = result?.data ?? result?.output ?? result ?? {}
  const entities: any[] = data.entities ?? []
  const relations: any[] = data.relations ?? []

  const entityCount = entities.length
  const relationCount = relations.length

  // --- Schema error rate ---
  const schemaErrorRate = (!data.entities) ? 1 : 0

  // --- Entity types from output ---
  const outputTypesSet = new Set<string>()
  for (const e of entities) {
    if (e.type) outputTypesSet.add(String(e.type).trim())
  }
  const entityTypes = Array.from(outputTypesSet)

  // --- Type coverage ---
  const expectedTypes: string[] = sample.expected_entity_types ?? []
  const expectedTypesSet = new Set(expectedTypes.map((t) => t.trim()))
  let coveredCount = 0
  for (const t of entityTypes) {
    if (expectedTypesSet.has(t)) coveredCount++
  }
  const typeCoverage =
    expectedTypes.length > 0
      ? Number(((coveredCount / expectedTypes.length) * 100).toFixed(2))
      : 0

  // --- Expected entities recall ---
  const expectedEntities: { name: string; type: string }[] =
    sample.expected_primary_entities ?? []
  const expectedTotal = expectedEntities.length
  let expectedFound = 0
  for (const expected of expectedEntities) {
    const targetName = expected.name.toLowerCase()
    const found = entities.some((e: any) => {
      const ename = (e.name ?? '').toLowerCase()
      return ename.includes(targetName) || targetName.includes(ename)
    })
    if (found) expectedFound++
  }

  // --- Duplicate rate ---
  const nameCounts = new Map<string, number>()
  for (const e of entities) {
    const n = String(e.name ?? '').trim().toLowerCase()
    if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1)
  }
  const duplicateCount = Array.from(nameCounts.values()).filter((c) => c > 1).length
  const duplicateRate = entityCount > 0 ? duplicateCount / entityCount : 0

  // --- Runtime & tokens ---
  const runtimeMs = usage?.runtimeMs ?? 0
  const promptTokens = usage?.promptTokens ?? 0
  const completionTokens = usage?.completionTokens ?? 0
  const totalTokens = usage?.totalTokens ?? 0

  // --- Cost estimate (DeepSeek pricing) ---
  // $0.27 / 1M prompt tokens, $1.10 / 1M completion tokens
  const promptCost = (promptTokens / 1_000_000) * 0.27
  const completionCost = (completionTokens / 1_000_000) * 1.10
  const estimatedCost = Number((promptCost + completionCost).toFixed(6))

  return {
    sampleId,
    entityCount,
    relationCount,
    entityTypes,
    typeCoverage,
    expectedFound,
    expectedTotal,
    duplicateRate: Number(duplicateRate.toFixed(4)),
    runtimeMs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost,
    schemaErrorRate,
  }
}
