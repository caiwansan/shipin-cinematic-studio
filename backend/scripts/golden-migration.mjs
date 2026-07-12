// === Golden Dataset Migration Script v1.0 ===
// RC2-T002.7 — 将 golden-v1-part1.json 迁移到 v1.0 Schema

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, '..', 'src', 'services', 'geo', 'provider', 'benchmark', 'golden');
const V1_DIR = join(GOLDEN_DIR, 'v1.0');

// ============================================================
// Helpers
// ============================================================

function coverageToBand(coverage) {
  if (coverage >= 85) return 'Excellent';
  if (coverage >= 70) return 'Good';
  if (coverage >= 50) return 'Fair';
  if (coverage >= 30) return 'Weak';
  return 'Poor';
}

function guessCountry(entityName, industry) {
  // Simple heuristic based on known brands
  const cnBrands = ['Shein', 'Temu', '拼多多', 'Pinduoduo', '京东', '小红书', '淘宝', '天猫', '唯品会', '得物', '美团', 'Meituan'];
  const usBrands = ['Amazon', 'Etsy', 'eBay', 'Walmart', 'Salesforce', 'HubSpot', 'Notion', 'Figma', 'Slack', 'Canva', 'Atlassian', 'Zapier', 'Monday.com', 'Airtable', 'Zoom', 'Stripe', 'Shopify', 'DocuSign', 'Okta', 'GitLab', 'Cloudflare', 'Adobe', 'Twilio', 'Workday'];
  const otherBrands = { 'Zalando': 'DE', 'Mercado Libre': 'AR', 'Coupang': 'KR', 'Rakuten': 'JP' };

  if (cnBrands.includes(entityName)) return 'CN';
  if (otherBrands[entityName]) return otherBrands[entityName];
  if (usBrands.includes(entityName)) return 'US';
  if (entityName === 'Alibaba.com') return 'CN';
  return 'US'; // default
}

function guessLanguage(country) {
  const map = { 'CN': 'zh', 'DE': 'de', 'AR': 'es', 'KR': 'ko', 'JP': 'ja' };
  return map[country] || 'en';
}

function inferSignalType(text) {
  const lower = text.toLowerCase();
  if (/\b(leader|leading|top|largest|biggest|number one|#1|market|dominant|major)\b/.test(lower)) return 'Market';
  if (/\b(platform|ecosystem|marketplace|suite|cloud|software)\b/.test(lower)) return 'Product';
  if (/\b(tool|app|service|solution|product|feature|function)\b/.test(lower)) return 'Product';
  if (/\b(brand|name|identity|logo|recognition)\b/.test(lower)) return 'Brand';
  if (/\b(ceo|founder|creator|inventor)\b/.test(lower)) return 'Founder';
  if (/\b(technology|tech|ai|ml|algorithm|data)\b/.test(lower)) return 'Technology';
  if (/\b(certified|certification|iso|standard)\b/.test(lower)) return 'Certification';
  if (/\b(industry|sector|field|domain)\b/.test(lower)) return 'Industry';
  if (/\b(competitor|competition|rival|alternative)\b/.test(lower)) return 'Competitor';
  if (/\b(global|world|international|region|china|us|europe)\b/.test(lower)) return 'Geography';
  return 'Concept';
}

function inferEntityType(entity) {
  const name = entity.entityName;
  const desc = (entity.description || '').toLowerCase();
  const industry = entity.industry;

  // E-commerce platforms
  if (industry === '电商') {
    if (/(平台|marketplace|电商|mall|shop|store|retail)/.test(desc) || /(Amazon|淘宝|天猫|eBay|Etsy|Walmart|Shopify|Temu|Shein)/.test(name)) return 'Platform';
    return 'Brand';
  }

  // SaaS
  if (/(crm|saas|software|cloud|platform|tool|app|solution|service)/.test(desc)) {
    if (/(salesforce|hubspot|atlassian|zapier|okta|twilio|workday|adobe|cloudflare)/i.test(name)) return 'Company';
    if (/(notion|figma|slack|canva|zoom|stripe|gitlab)/i.test(name)) return 'Company';
    return 'Company';
  }

  return 'Company';
}

function inferIntent(entity) {
  const type = entity.entityType || inferEntityType(entity);

  if (type === 'Platform') return ['discover-brand', 'assess-trust'];
  if (type === 'Brand') return ['discover-brand'];
  return ['discover-brand', 'select-vendor'];
}

function makeEvidence(entity) {
  return [{
    type: 'official_website',
    url: entity.website || 'https://example.com',
    accessedAt: '2026-07-02',
    description: entity.description || `${entity.entityName} 官方信息`
  }];
}

function makeSignals(signals) {
  if (!signals || signals.length === 0) {
    return [{ type: 'Brand', text: entity.entityName, importance: 'High' }];
  }

  return signals.map((text, i) => ({
    type: inferSignalType(text),
    text,
    importance: i === 0 ? 'High' : 'Medium'
  }));
}

function mapScenarioIds(oldScenarios) {
  // Old numeric IDs to new string IDs
  const map = {
    1: 'discover-brand',
    2: 'compare-brands',
    3: 'evaluate-product-safety',
    4: 'evaluate-shop-trust',
    5: 'research-product',
    6: 'select-vendor',
    7: 'find-alternative',
    8: 'check-pricing',
    9: 'check-certifications',
    10: 'understand-features',
    11: 'assess-market-position',
    12: 'get-recommendation',
    13: 'compare-prices',
    14: 'check-availability',
    15: 'verify-credentials',
    16: 'assess-quality'
  };

  if (!oldScenarios) return ['discover-brand'];
  return oldScenarios.map(id => map[id] || 'discover-brand').filter((v, i, a) => a.indexOf(v) === i);
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log('=== Golden Dataset Migration v1.0 ===\n');

  // Read source
  const sourcePath = join(GOLDEN_DIR, 'golden-v1-part1.json');
  if (!existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(sourcePath, 'utf-8'));
  console.log(`Read ${raw.length} entities from golden-v1-part1.json`);

  // Ensure output dir
  mkdirSync(V1_DIR, { recursive: true });

  // Process each entity
  const industries = {};
  const results = [];
  const errors = [];

  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];
    try {
      const country = guessCountry(e.entityName, e.industry);
      const language = guessLanguage(country);
      const entityType = e.entityType === 'saas' ? inferEntityType(e) :
                         e.entityType === '电商' ? 'Platform' : inferEntityType(e);
      const industry = e.industry === 'SaaS' ? 'saas' : 'ecommerce';

      const entity = {
        id: e.id,
        entityName: e.entityName,
        entityType,
        industry,
        country,
        language,
        website: e.website,
        description: e.description,
        expectedScenarios: mapScenarioIds(e.expectedScenarios),
        expectedIntent: inferIntent({ ...e, entityType }),
        expectedKnowledgeSignals: makeSignals(e.expectedKnowledgeSignals),
        expectedEntities: e.expectedEntities || [],
        expectedCoverageBand: coverageToBand(e.expectedCoverage),
        expectedConfidenceBand: 'Medium',
        evidence: makeEvidence(e),
        version: '1.0.0',
        reviewStatus: 'draft',
        origin: 'imported',
        notes: e.note || ''
      };

      if (!industries[industry]) industries[industry] = [];
      industries[industry].push(entity);
      results.push(entity);
    } catch (err) {
      errors.push({ index: i, id: e.id, error: err.message });
      console.error(`  Error processing ${e.id}: ${err.message}`);
    }
  }

  // Write industry-split files
  for (const [industry, entities] of Object.entries(industries)) {
    const metadata = {
      datasetVersion: '1.0.0',
      schemaVersion: '1.0',
      annotationGuideVersion: '1.0',
      frozenAt: '2026-07-02',
      owner: 'GEO Team',
      reviewers: ['熊大'],
      approved: false,
      approvalDate: null,
      source: 'manual-annotation',
      description: `${industry} 行业 Golden Dataset，${entities.length} 条样本`,
      schemaRef: '../GOLDEN-DATASET-SPEC-V1.md',
      annotationGuideRef: '../GOLDEN-DATASET-ANNOTATION-GUIDE-V1.md',
      scenarioSource: 'Discovery Scenario Registry v1',
      changelog: [
        { date: '2026-07-02', change: 'Migrated from v1-part1 to v1.0 Schema', author: 'OpenClaw' }
      ],
      count: entities.length,
      industries: [industry],
      entityTypes: [...new Set(entities.map(e => e.entityType))],
      coverageBands: [...new Set(entities.map(e => e.expectedCoverageBand))]
    };

    const output = { _metadata: metadata, ...Object.fromEntries(entities.map(e => [e.id, e])) };
    const outputPath = join(V1_DIR, `${industry}.json`);
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Wrote ${entities.length} entities to ${outputPath}`);
  }

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Industries: ${Object.keys(industries).join(', ')}`);
  for (const [ind, ents] of Object.entries(industries)) {
    console.log(`  ${ind}: ${ents.length} entities`);
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  [${e.index}] ${e.id}: ${e.error}`));
  }
}

main();
