// ============================================================
// P0-T006: Evidence Timeline Builder
// 从 project config 和 scan history 提取事件，按时间排序
// ============================================================

import type { VerificationEvidence } from './types';
import { generateEvidenceId } from './types';

interface ProjectSnapshot {
  id?: string;
  timestamp: string;
  adi: number;
  aiPresenceScore?: number;
  metadata?: Record<string, any>;
}

interface ScanEvent {
  timestamp: string;
  type: string;
  description: string;
  score?: number;
  metadata?: Record<string, any>;
}

/**
 * 构建证据时间线
 * 从 project config 和 scan history 提取事件，按时间排序
 */
export function buildEvidenceTimeline(
  project: any,
  beforeTimestamp: string,
  currentTimestamp: string
): VerificationEvidence[] {
  const evidence: VerificationEvidence[] = [];

  // 1. 初始扫描 — 来自 before 时间点
  evidence.push({
    id: generateEvidenceId(),
    type: 'snapshot',
    source: 'initial_scan',
    content: `Initial scan completed`,
    timestamp: beforeTimestamp,
    confidence: 90,
    metadata: { phase: 'before' },
  });

  // 2. 从 project.optimizations / scanHistory 提取事件
  const optimizations = extractOptimizations(project);
  for (const opt of optimizations) {
    evidence.push({
      id: generateEvidenceId(),
      type: 'optimization',
      source: opt.type || 'optimization_action',
      content: opt.description || 'Optimization action executed',
      timestamp: opt.timestamp,
      confidence: 85,
      metadata: { ...opt.metadata, phase: 'optimization' },
    });
  }

  // 3. AI Presence 检测事件
  const presenceEvents = extractPresenceEvents(project);
  for (const ev of presenceEvents) {
    evidence.push({
      id: generateEvidenceId(),
      type: 'ai_presence',
      source: ev.type || 'ai_presence_check',
      content: ev.description || 'AI presence detected',
      timestamp: ev.timestamp,
      confidence: 80,
      metadata: { ...ev.metadata, phase: 'presence' },
    });
  }

  // 4. 最终扫描 — after 时间点
  evidence.push({
    id: generateEvidenceId(),
    type: 'snapshot',
    source: 'final_scan',
    content: `Final scan completed`,
    timestamp: currentTimestamp,
    confidence: 90,
    metadata: { phase: 'after' },
  });

  // 5. 按时间排序
  evidence.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return evidence;
}

/**
 * 从 project 对象提取优化事件
 */
function extractOptimizations(project: any): ScanEvent[] {
  const events: ScanEvent[] = [];

  // 尝试从 project.config.optimizations 提取
  const configOptimizations = project?.config?.optimizations || project?.optimizations || [];
  if (Array.isArray(configOptimizations)) {
    for (const opt of configOptimizations) {
      events.push({
        timestamp: opt.createdAt || opt.timestamp || new Date().toISOString(),
        type: opt.type || 'optimization',
        description: opt.action || opt.description || 'Optimization executed',
        metadata: { optimizationId: opt.id, status: opt.status },
      });
    }
  }

  // 从 scanHistory 提取
  const scanHistory = project?.scanHistory || project?.scan_history || [];
  if (Array.isArray(scanHistory)) {
    for (const scan of scanHistory) {
      if (scan.type === 'optimization' || scan.type === 'schema') {
        events.push({
          timestamp: scan.createdAt || scan.timestamp || new Date().toISOString(),
          type: scan.type || 'optimization',
          description: scan.description || scan.action || `Scan: ${scan.type}`,
          score: scan.adi || scan.score,
          metadata: { scanId: scan.id },
        });
      }
    }
  }

  return events;
}

/**
 * 从 project 提取 AI Presence 检测事件
 */
function extractPresenceEvents(project: any): ScanEvent[] {
  const events: ScanEvent[] = [];

  // 从 presence report 提取
  const presenceReports = project?.config?.presenceReports || project?.presenceReports || [];
  if (Array.isArray(presenceReports)) {
    for (const report of presenceReports) {
      events.push({
        timestamp: report.checkedAt || report.createdAt || new Date().toISOString(),
        type: 'ai_presence_check',
        description: `AI presence check: ${report.overall?.score || report.score || 'N/A'} pts`,
        score: report.overall?.score || report.score,
        metadata: { reportId: report.id, providers: report.providers?.length },
      });
    }
  }

  return events;
}
