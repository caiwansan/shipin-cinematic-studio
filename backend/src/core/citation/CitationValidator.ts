// ============================================================
// Citation Validator — Input validation for Citation CRUD
// ============================================================

import type { CreateCitationInput, UpdateCitationInput, AuthorityLevel } from './types'

const VALID_FORMATS = ['apa', 'mla', 'custom']
const VALID_AUTHORITY_LEVELS: AuthorityLevel[] = ['government', 'academic', 'industry', 'news', 'community']
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const URL_REGEX = /^https?:\/\/.+/i
const MAX_CITATION_TEXT_LENGTH = 5000

function validateRequired(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `${label} is required`
  }
  return null
}

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

function isValidUrl(value: string): boolean {
  return URL_REGEX.test(value)
}

export function validateCreateCitation(input: CreateCitationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // evidenceId: required, UUID format
  const evidenceIdErr = validateRequired(input.evidenceId, 'evidenceId')
  if (evidenceIdErr) {
    errors.push(evidenceIdErr)
  } else if (!isUUID(input.evidenceId)) {
    errors.push('evidenceId must be a valid UUID')
  }

  // citationText: required, max 5000 chars
  const textErr = validateRequired(input.citationText, 'citationText')
  if (textErr) {
    errors.push(textErr)
  } else if (input.citationText.length > MAX_CITATION_TEXT_LENGTH) {
    errors.push(`citationText must not exceed ${MAX_CITATION_TEXT_LENGTH} characters`)
  }

  // format: must be one of 'apa' | 'mla' | 'custom'
  if (input.format && !VALID_FORMATS.includes(input.format)) {
    errors.push(`format must be one of: ${VALID_FORMATS.join(', ')}`)
  }

  // authorityLevel: must be valid
  if (input.authorityLevel && !VALID_AUTHORITY_LEVELS.includes(input.authorityLevel)) {
    errors.push(`authorityLevel must be one of: ${VALID_AUTHORITY_LEVELS.join(', ')}`)
  }

  // sourceUrl: if provided, must be a valid URL
  if (input.sourceUrl && !isValidUrl(input.sourceUrl)) {
    errors.push('sourceUrl must be a valid URL (http/https)')
  }

  return { valid: errors.length === 0, errors }
}

export function validateUpdateCitation(input: UpdateCitationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // At least one field must be provided
  const keys = Object.keys(input)
  if (keys.length === 0) {
    errors.push('At least one field must be provided for update')
    return { valid: false, errors }
  }

  // citationText: max 5000 chars
  if (input.citationText !== undefined) {
    if (input.citationText.length > MAX_CITATION_TEXT_LENGTH) {
      errors.push(`citationText must not exceed ${MAX_CITATION_TEXT_LENGTH} characters`)
    }
  }

  // format: must be one of 'apa' | 'mla' | 'custom'
  if (input.format && !VALID_FORMATS.includes(input.format)) {
    errors.push(`format must be one of: ${VALID_FORMATS.join(', ')}`)
  }

  // authorityLevel: must be valid
  if (input.authorityLevel && !VALID_AUTHORITY_LEVELS.includes(input.authorityLevel)) {
    errors.push(`authorityLevel must be one of: ${VALID_AUTHORITY_LEVELS.join(', ')}`)
  }

  // sourceUrl: if provided, must be a valid URL
  if (input.sourceUrl && !isValidUrl(input.sourceUrl)) {
    errors.push('sourceUrl must be a valid URL (http/https)')
  }

  return { valid: errors.length === 0, errors }
}
