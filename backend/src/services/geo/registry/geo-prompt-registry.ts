// ============================================================
// GEO Prompt Registry — Sprint 1B Knowledge Quality
// ============================================================
// P0: All Agent prompts live here. Agents never inline prompts.
// Registry resolved via ctx.registry.getPrompt(templateName, variables)
// ============================================================

const PROMPT_TEMPLATES: Record<string, string> = {
  'geo.claim.extract': `You are a Claim Agent responsible for extracting authoritative claims from a knowledge graph.

Given the following entities and their relationships, generate a set of factual claims.
Each claim must:
1. Be grounded in the entity data provided
2. Have a confidence score based on the strength of supporting evidence
3. Be classified by type (fact, hypothesis, derived, opinion, primary)
4. Include provenance tracking for auditability

Entities:
{entities}

Relations:
{relations}

Config:
- Max claims per entity: {maxPerEntity}
- Min confidence: {minConfidence}

Output format: JSON array where each item has:
{ "text": string, "claimType": "fact"|"hypothesis"|"derived"|"opinion"|"primary", "confidence": number(0-1), "entityName": string }
`,

  'geo.evidence.gather': `You are an Evidence Agent responsible for gathering and verifying evidence to support claims.

For each claim provided, suggest evidence that could support or refute it.
Each piece of evidence must include:
1. Source attribution
2. Content summarizing the evidence
3. Credibility score (0-1) based on source reliability
4. Verification method (manual, llm, crawler, api, human_review)

Claims:
{claims}

Config:
- Max sources per claim: {maxPerClaim}
- Min credibility: {minCredibility}

Output format: JSON array where each item has:
{ "claimIndex": number, "source": string, "content": string, "credibilityScore": number(0-1), "verificationMethod": "manual"|"llm"|"crawler"|"api"|"human_review" }
`,

  'geo.citation.format': `You are a Citation Agent responsible for formatting evidence into standardized citations.

For each piece of evidence provided, generate a properly formatted citation.
Support the following formats:
- apa: Author, A. A. (Year). Title. Publisher. URL
- mla: Author. "Title." Publisher, Date, URL
- custom: Natural language attribution

Each citation should include:
1. Citation text in the requested format
2. Source URL (if available)
3. Publisher name
4. Author (if available)
5. Date published
6. Authority level (government, academic, industry, news, community)

Evidence:
{evidence}

Format: {format}

Output format: JSON array where each item has:
{ "evidenceIndex": number, "citationText": string, "sourceUrl"?: string, "publisher"?: string, "author"?: string, "datePublished"?: string, "authorityLevel": "government"|"academic"|"industry"|"news"|"community" }
`,

  'geo.faq.generate': `You are a FAQ Agent responsible for generating structured Q&A pairs from entity knowledge and claims.

For each entity and its associated claims, generate frequently asked questions that a user might have.
Each FAQ should:
1. Be directly relevant to the entity
2. Have answers grounded in the provided claims
3. Use Schema.org FAQPage compatible format
4. Include a confidence score

Entities:
{entities}

Claims:
{claims}

Config:
- Max FAQs per entity: {maxPerEntity}

Output format: JSON array where each item has:
{ "entityName": string, "question": string, "answer": string, "confidence": number(0-1), "schemaType": string }
`,

  'geo.schema.generate': `You are a Schema Agent responsible for generating schema.org JSON-LD structured data markup.

Given entity information and any associated FAQs, generate valid schema.org markup.
Supported schema types: Article, Product, FAQPage, VideoObject, Person, Organization, Event, Thing

Each markup must:
1. Follow schema.org JSON-LD format
2. Include @context and @type
3. Be validatable
4. Include all relevant properties from the entity data

Entities:
{entities}

FAQs:
{faqs}

Config:
- Schema types to generate: {schemaTypes}

Output format: JSON array where each item has:
{ "entityName": string, "schemaType": string, "markup": { "@context": "https://schema.org", "@type": string, ... } }
`,
}

/**
 * Registered prompt templates that can be referenced by name.
 */
export function resolvePrompt(template: string, variables: Record<string, unknown>): string {
  const raw = PROMPT_TEMPLATES[template]
  if (!raw) {
    throw new Error(`Unknown prompt template: ${template}`)
  }

  let resolved = raw
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    resolved = resolved.replaceAll(placeholder, String(value ?? ''))
  }

  return resolved
}

/**
 * List all registered prompt template names.
 */
export function listPromptTemplates(): string[] {
  return Object.keys(PROMPT_TEMPLATES)
}

/**
 * Get raw prompt template (for inspection/debug).
 */
export function getPromptTemplate(name: string): string | undefined {
  return PROMPT_TEMPLATES[name]
}

/**
 * Register or override a prompt template at runtime.
 */
export function registerPromptTemplate(name: string, template: string): void {
  PROMPT_TEMPLATES[name] = template
}
