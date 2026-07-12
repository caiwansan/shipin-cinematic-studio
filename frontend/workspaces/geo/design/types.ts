/**
 * Type utility for GeoTokens shape — ensures the source object satisfies
 * the expected interface without widening the literal types.
 */

export interface GeoTokensShape {
  space: Record<string, string>
  radius: Record<string, string>
  text: Record<string, { size: string; lineHeight: string; weight: string }>
  font: Record<string, string>
  icon: Record<string, string>
  weight: Record<string, string>
  duration: Record<string, number>
  easing: Record<string, string>
  shadow: Record<string, string>
  z: Record<string, number>
  bp: Record<string, string>
  color: Record<string, string>
  priority: Record<string, string>
  chart: Record<string, string>
  [key: string]: Record<string, string | number | Record<string, unknown>>
}
