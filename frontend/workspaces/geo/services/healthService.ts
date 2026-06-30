/**
 * GEO Health Service — Mock Implementation
 *
 * Provides mock data for three scenarios:
 * - normal: BrandHealth 82, mixed dimensions, 3 recommendations
 * - low: BrandHealth 45, red state, multiple warnings
 * - empty: null (triggers EmptyState)
 *
 * After backend is ready, replace with real API call.
 */

export interface BrandHealthData {
  brandHealth: {
    score: number
    trend: number
    label: string
    definition: string
  } | null
  dimensions: Array<{
    name: string
    score: number
    previousScore: number
    isWarning: boolean
    explanation: string
  }>
  dailyChange: number
  recommendations: Array<{
    id: string
    title: string
    expectedImpact: number
    effort: 'low' | 'medium' | 'high'
    reason: string
  }>
}

const MOCK_DATA: Record<string, BrandHealthData> = {
  normal: {
    brandHealth: {
      score: 82,
      trend: 4,
      label: 'Good, but needs improvement',
      definition: 'Brand Health is a measure of how understandable, trustworthy, and recommendable your brand is to AI systems.',
    },
    dimensions: [
      {
        name: 'Knowledge Coverage',
        score: 76,
        previousScore: 72,
        isWarning: false,
        explanation: '2 pages missing from AI index. Adding structured data will improve coverage.',
      },
      {
        name: 'AI Visibility',
        score: 69,
        previousScore: 65,
        isWarning: true,
        explanation: '3 keywords below threshold. Improving keyword presence in brand descriptions.',
      },
      {
        name: 'Trust',
        score: 88,
        previousScore: 85,
        isWarning: false,
        explanation: 'Strong verification signals. Your brand information is consistent across sources.',
      },
      {
        name: 'Freshness',
        score: 73,
        previousScore: 70,
        isWarning: false,
        explanation: 'Last publish was 14 days ago. Regular updates improve freshness.',
      },
      {
        name: 'Authority',
        score: 85,
        previousScore: 83,
        isWarning: false,
        explanation: 'Your brand is referenced by authoritative sources.',
      },
      {
        name: 'Risk',
        score: 95,
        previousScore: 94,
        isWarning: false,
        explanation: 'No significant risks detected. Brand information is consistent.',
      },
    ],
    dailyChange: 4,
    recommendations: [
      {
        id: 'rec-1',
        title: 'Fix knowledge coverage gap',
        expectedImpact: 8,
        effort: 'medium',
        reason: 'Adding 2 missing pages to AI index will significantly improve Knowledge Coverage.',
      },
      {
        id: 'rec-2',
        title: 'Improve AI visibility',
        expectedImpact: 5,
        effort: 'low',
        reason: 'Strengthening 3 key brand keywords will boost AI visibility score.',
      },
      {
        id: 'rec-3',
        title: 'Publish brand update',
        expectedImpact: 3,
        effort: 'low',
        reason: 'Recent updates improve Freshness and demonstrate active brand management.',
      },
    ],
  },

  low: {
    brandHealth: {
      score: 45,
      trend: -8,
      label: 'Needs immediate attention',
      definition: 'Brand Health is a measure of how understandable, trustworthy, and recommendable your brand is to AI systems.',
    },
    dimensions: [
      {
        name: 'Knowledge Coverage',
        score: 38,
        previousScore: 42,
        isWarning: true,
        explanation: 'Major coverage gaps. Most brand pages are not indexed by AI systems.',
      },
      {
        name: 'AI Visibility',
        score: 29,
        previousScore: 35,
        isWarning: true,
        explanation: 'Brand is barely visible in AI responses. Critical keywords missing.',
      },
      {
        name: 'Trust',
        score: 55,
        previousScore: 58,
        isWarning: true,
        explanation: 'Inconsistent brand information detected across sources.',
      },
      {
        name: 'Freshness',
        score: 41,
        previousScore: 45,
        isWarning: true,
        explanation: 'No updates in over 30 days. Brand information is stale.',
      },
      {
        name: 'Authority',
        score: 52,
        previousScore: 55,
        isWarning: true,
        explanation: 'Few external references to your brand.',
      },
      {
        name: 'Risk',
        score: 60,
        previousScore: 62,
        isWarning: true,
        explanation: 'Multiple inconsistencies increase brand risk.',
      },
    ],
    dailyChange: -8,
    recommendations: [
      {
        id: 'rec-1',
        title: 'Connect website to AI index',
        expectedImpact: 15,
        effort: 'high',
        reason: 'Your website is not properly connected. This is the highest impact action.',
      },
      {
        id: 'rec-2',
        title: 'Update brand description',
        expectedImpact: 10,
        effort: 'low',
        reason: 'Current brand description is missing key information that AI systems need.',
      },
      {
        id: 'rec-3',
        title: 'Add structured data to pages',
        expectedImpact: 8,
        effort: 'medium',
        reason: 'Schema markup helps AI systems understand your brand content.',
      },
    ],
  },

  empty: {
    brandHealth: null,
    dimensions: [],
    dailyChange: 0,
    recommendations: [],
  },
}

/**
 * Fetch Brand Health data from the server.
 *
 * Currently returns mock data with a simulated 500ms delay.
 * Replace with real API call when backend is ready:
 *   GET /api/geo/health
 *
 * @param scenario - Which mock scenario to use (default: 'normal')
 */
export async function fetchHealth(
  scenario: 'normal' | 'low' | 'empty' = 'normal',
): Promise<BrandHealthData> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return MOCK_DATA[scenario]
}
