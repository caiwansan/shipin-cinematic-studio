// ============================================================
// Citation Module — Unified exports
// ============================================================

export * from './types'
export { citationRepository } from './CitationRepository'
export { citationService } from './CitationService'
export { validateCreateCitation, validateUpdateCitation } from './CitationValidator'
export { formatCitation, generateHtmlCitation, generateMarkdownCitation } from './CitationFormatter'

// DTOs
export type { CreateCitationRequest } from './dto/create.dto'
export type { UpdateCitationRequest } from './dto/update.dto'
export type { SearchCitationsQuery } from './dto/search.dto'
export type { CitationResponse, PaginatedCitationResponse } from './dto/response.dto'
