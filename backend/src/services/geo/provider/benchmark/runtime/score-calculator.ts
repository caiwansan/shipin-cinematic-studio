import type { ScoreCategory, BandLevel } from './types';

export function calculateOverallScore(dimensions: { category: ScoreCategory; score: number; weight: number }[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;
  return Math.round(dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0) / totalWeight);
}

export const BAND_THRESHOLDS: { level: BandLevel; min: number }[] = [
  { level: 'Excellent', min: 90 },
  { level: 'Good', min: 75 },
  { level: 'Fair', min: 60 },
  { level: 'Weak', min: 40 },
  { level: 'Poor', min: 0 },
];

export function scoreToBand(score: number): BandLevel {
  const match = BAND_THRESHOLDS.find(t => score >= t.min);
  return match ? match.level : 'Poor';
}
