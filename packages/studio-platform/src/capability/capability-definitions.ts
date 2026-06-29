/**
 * Capability Definitions — Standard capability ID registry.
 *
 * This file registers the standard capability IDs used across the platform.
 * Each capability has a human-readable name and description.
 * The actual routing to providers and models is handled by CapabilityRuntime.
 *
 * @package @studio/platform/capability
 * @see CAPABILITY-SPEC.md §2.5
 */

import type { CapabilityId } from './types';

/**
 * Standard capability definitions.
 * New capabilities should be added here with a description.
 */
export const CapabilityDefinitions: Record<CapabilityId, {
  name: string;
  description: string;
}> = {
  // ============ LLM Capabilities ============

  'llm.reasoning': {
    name: 'LLM Reasoning',
    description: 'General reasoning and analysis using large language models',
  },
  'llm.extraction': {
    name: 'LLM Extraction',
    description: 'Structured data extraction from unstructured text',
  },
  'llm.translation': {
    name: 'LLM Translation',
    description: 'Text translation between multiple languages',
  },
  'llm.summary': {
    name: 'LLM Summary',
    description: 'Text summarization and condensation',
  },

  // ============ Image Capabilities ============

  'image.generate': {
    name: 'Image Generation',
    description: 'Text-to-image generation',
  },
  'image.edit': {
    name: 'Image Editing',
    description: 'Image inpainting/outpainting',
  },

  // ============ Video Capabilities ============

  'video.generate': {
    name: 'Video Generation',
    description: 'Text-to-video generation',
  },
  'video.edit': {
    name: 'Video Editing',
    description: 'Video editing/transformation',
  },

  // ============ Audio Capabilities ============

  'tts.generate': {
    name: 'Text-to-Speech',
    description: 'Text to speech synthesis',
  },
  'asr.transcribe': {
    name: 'Speech-to-Text',
    description: 'Audio transcription',
  },

  // ============ Embedding & Search Capabilities ============

  'embedding.create': {
    name: 'Embedding',
    description: 'Text vector embedding',
  },
  'rerank.execute': {
    name: 'Reranking',
    description: 'Search result reranking',
  },
  'search.execute': {
    name: 'Search',
    description: 'Semantic/hybrid search',
  },

  // ============ Knowledge & Processing Capabilities ============

  'ocr.extract': {
    name: 'OCR',
    description: 'Optical character recognition',
  },
  'knowledge.extract': {
    name: 'Knowledge Extraction',
    description: 'Entity/relation extraction',
  },
  'cognition.execute': {
    name: 'Cognition',
    description: 'Multi-modal reasoning',
  },
} as const;

/**
 * Get the display name for a capability ID.
 */
export function getCapabilityName(capabilityId: CapabilityId): string {
  return CapabilityDefinitions[capabilityId]?.name ?? capabilityId;
}

/**
 * Get the description for a capability ID.
 */
export function getCapabilityDescription(capabilityId: CapabilityId): string {
  return CapabilityDefinitions[capabilityId]?.description ?? '';
}

/**
 * Check if a capability ID is a known standard capability.
 */
export function isKnownCapability(capabilityId: CapabilityId): boolean {
  return capabilityId in CapabilityDefinitions;
}
