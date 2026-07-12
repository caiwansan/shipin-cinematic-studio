import { x as defineEventHandler, af as getRouterParam, t as createError } from '../../../../_/h3.mjs';
import { f as useRuntimeConfig } from '../../../../nitro/nitro.mjs';
import 'rou3';
import 'srvx';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const SEED = {
  brand: {
    "\u6606\u4ED1\u955C": {
      identity: { name: "\u6606\u4ED1\u955C", slug: "\u6606\u4ED1\u955C", type: "brand", id: "2cccfaaf-de48-450b-aea9-1bd9c31c2091", canonicalUrl: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C" },
      content: {
        summary: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002",
        body: [
          { order: 1, label: "Summary", type: "text", content: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002" },
          { order: 2, label: "Description", type: "markdown", content: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002\n\n**\u4F7F\u547D**: \u8BA9\u6BCF\u4E2A\u4EBA\u90FD\u80FD\u521B\u4F5C\u5F71\u89C6\u7EA7\u77ED\u5267\n\n**\u613F\u666F**: \u6210\u4E3A\u5168\u7403\u9886\u5148\u7684 AI \u77ED\u5267\u521B\u4F5C\u5E73\u53F0\n\n**\u4EF7\u503C\u89C2**: \u521B\u65B0\u3001\u7528\u6237\u81F3\u4E0A\u3001\u54C1\u8D28\u7B2C\u4E00" },
          { order: 3, label: "FAQ", type: "markdown", content: "" }
        ],
        features: [],
        useCases: []
      },
      metadata: {
        title: "\u6606\u4ED1\u955C",
        description: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002",
        robots: "index, follow",
        keywords: ["AI / \u4EBA\u5DE5\u667A\u80FD", "\u6606\u4ED1\u955C", "brand"],
        lang: "zh-CN",
        canonical: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C",
        og: { title: "\u6606\u4ED1\u955C", description: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002", type: "website", url: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C" },
        twitter: { card: "summary", title: "\u6606\u4ED1\u955C", description: "\u4E00\u7AD9\u5F0F AI \u89C6\u9891\u751F\u6210\u5E73\u53F0\uFF0C\u9762\u5411\u77ED\u5267\u521B\u4F5C\u8005\u7684\u667A\u80FD\u5236\u7247\u5DE5\u5177\u3002" }
      },
      version: { manifestVersion: "1.0.0", contentVersion: 1, compiledAt: (/* @__PURE__ */ new Date()).toISOString() },
      routing: { path: "/knowledge/brand/\u6606\u4ED1\u955C", params: { slug: "\u6606\u4ED1\u955C" }, version: 1, routeName: "knowledge-brand", updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
      structuredData: { jsonld: [{ "@context": "https://schema.org", "@type": "WebPage", "@id": "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C", url: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C", name: "\u6606\u4ED1\u955C", dateModified: (/* @__PURE__ */ new Date()).toISOString() }], schemaTypes: ["WebPage"] },
      publishing: { source: "knowledge-hub", status: "published", confidence: 0.8, publishedAt: (/* @__PURE__ */ new Date()).toISOString(), snapshotVersion: "v1" },
      discoverability: {
        links: [
          { rel: "canonical", href: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C" },
          { rel: "alternate", href: "http://aigc.fushtn.com/knowledge/brand/\u6606\u4ED1\u955C", title: "\u6606\u4ED1\u955C" }
        ],
        inFeed: true,
        feedType: "brand",
        inSitemap: true,
        llmsSection: "Brands",
        sitemapPriority: 0.9,
        sitemapChangefreq: "weekly"
      },
      assets: { gallery: [], attachments: [] }
    }
  }
};
const _slug_ = defineEventHandler(async (event) => {
  const type = getRouterParam(event, "type");
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Slug is required" });
  if (!type) throw createError({ statusCode: 400, message: "Type is required" });
  const decodedSlug = decodeURIComponent(slug);
  const typeData = SEED[type];
  const staticData = (typeData == null ? void 0 : typeData[slug]) || (typeData == null ? void 0 : typeData[decodedSlug]);
  if (staticData) {
    event.handled = true;
    return { success: true, manifest: staticData };
  }
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase || "http://localhost:4002";
  const url = `${apiBase}/api/v1/public/knowledge/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json", "Connection": "close" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) {
      if (response.status === 404) throw createError({ statusCode: 404, message: `${type} not found` });
      throw new Error(`Backend error: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    if (err.statusCode) throw err;
    console.error(`[knowledge/${type}] fetch error for slug="${slug}":`, err.message);
    throw createError({ statusCode: 404, message: `${type} not found` });
  }
});

export { _slug_ as default };
//# sourceMappingURL=_slug_.mjs.map
