/**
 * Diff Engine
 *
 * Computes diffs between two sets of regression results and assigns risk levels.
 */

export interface DiffResult {
  objectsWithChanges: string[]
  recommendationChanges: string[]
  maxScoreDelta: number
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  summary: string
}

export interface ObjectResult {
  objectId: string
  quality: { score: number; label: string }
  recommendation: { priority: string }
}

function findObjectResults(results: any): ObjectResult[] {
  // Results can be either an array of { objectId, expectedInsight } or
  // a custom results object with a 'results' field
  if (Array.isArray(results)) {
    return results.map((r: any) => ({
      objectId: r.objectId || r.id || 'unknown',
      quality: r.quality || r.expectedInsight?.quality || { score: 0, label: 'C' },
      recommendation: r.recommendation || r.expectedInsight?.recommendation || { priority: 'Low' },
    }))
  }
  if (results && results.results && Array.isArray(results.results)) {
    return findObjectResults(results.results)
  }
  // Try to find results array at any level
  if (results && typeof results === 'object') {
    for (const key of Object.keys(results)) {
      if (Array.isArray(results[key]) && results[key].length > 0 && results[key][0].objectId) {
        return findObjectResults(results[key])
      }
    }
  }
  return []
}

export function computeDiff(oldResults: any, newResults: any): DiffResult {
  const oldObjects = findObjectResults(oldResults)
  const newObjects = findObjectResults(newResults)

  const oldMap = new Map<string, ObjectResult>()
  for (const obj of oldObjects) {
    oldMap.set(obj.objectId, obj)
  }

  const newMap = new Map<string, ObjectResult>()
  for (const obj of newObjects) {
    newMap.set(obj.objectId, obj)
  }

  const objectsWithChanges: string[] = []
  const recommendationChanges: string[] = []
  let maxScoreDelta = 0
  let recommendationChanged = false

  // Compare objects that exist in both
  for (const [objectId, newObj] of newMap) {
    const oldObj = oldMap.get(objectId)
    if (!oldObj) {
      objectsWithChanges.push(objectId)
      continue
    }

    const scoreDelta = Math.abs(newObj.quality.score - oldObj.quality.score)
    if (scoreDelta > maxScoreDelta) {
      maxScoreDelta = scoreDelta
    }

    const labelChanged = newObj.quality.label !== oldObj.quality.label
    const scoreChanged = scoreDelta > 0

    if (scoreChanged || labelChanged) {
      objectsWithChanges.push(objectId)
    }

    if (newObj.recommendation.priority !== oldObj.recommendation.priority) {
      recommendationChanges.push(
        `${objectId}: ${oldObj.recommendation.priority} → ${newObj.recommendation.priority}`,
      )
      recommendationChanged = true
    }
  }

  // Objects only in old (removed)
  for (const [objectId, _oldObj] of oldMap) {
    if (!newMap.has(objectId)) {
      objectsWithChanges.push(`${objectId} (removed)`)
    }
  }

  // Determine risk level
  let riskLevel: DiffResult['riskLevel'] = 'NONE'
  if (recommendationChanged) {
    riskLevel = 'HIGH'
  } else if (maxScoreDelta >= 10) {
    // Check if label changed
    const labelChanged = [...newMap.entries()].some(([id, newObj]) => {
      const oldObj = oldMap.get(id)
      return oldObj && newObj.quality.label !== oldObj.quality.label
    })
    if (labelChanged) {
      riskLevel = 'MEDIUM'
    } else {
      riskLevel = 'LOW'
    }
  } else if (maxScoreDelta > 0) {
    riskLevel = 'LOW'
  }

  // Build summary
  const summaryParts: string[] = []
  summaryParts.push(`Objects with changes: ${objectsWithChanges.length}`)
  if (recommendationChanges.length > 0) {
    summaryParts.push(`Recommendation changes: ${recommendationChanges.length}`)
  }
  summaryParts.push(`Max score delta: ${maxScoreDelta}`)
  summaryParts.push(`Risk level: ${riskLevel}`)

  return {
    objectsWithChanges,
    recommendationChanges,
    maxScoreDelta,
    riskLevel,
    summary: summaryParts.join(' | '),
  }
}

export default computeDiff
