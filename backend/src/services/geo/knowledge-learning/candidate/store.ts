// ============================================================
// Candidate Store — In-memory CRUD
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import type { ReplayCandidate, CandidateStatus } from '../types';

// In-memory Candidate Store（后续可迁移到 Prisma）
const candidates = new Map<string, ReplayCandidate>();

export const candidateStore = {
  getAll: (status?: CandidateStatus): ReplayCandidate[] => {
    const all = Array.from(candidates.values());
    return status ? all.filter(c => c.status === status) : all;
  },

  getById: (id: string): ReplayCandidate | undefined => {
    return candidates.get(id);
  },

  create: (candidate: Omit<ReplayCandidate, 'candidateId' | 'createdAt' | 'updatedAt'>): ReplayCandidate => {
    const now = new Date().toISOString();
    const entry: ReplayCandidate = {
      ...candidate,
      candidateId: `candidate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    candidates.set(entry.candidateId, entry);
    return entry;
  },

  updateStatus: (id: string, status: CandidateStatus): ReplayCandidate | undefined => {
    const entry = candidates.get(id);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    return entry;
  },

  getStats: () => {
    const all = Array.from(candidates.values());
    return {
      total: all.length,
      new: all.filter(c => c.status === 'new').length,
      reviewing: all.filter(c => c.status === 'reviewing').length,
      approved: all.filter(c => c.status === 'approved').length,
      rejected: all.filter(c => c.status === 'rejected').length,
      golden: all.filter(c => c.status === 'golden').length,
      approveRate: all.length > 0
        ? Math.round((all.filter(c => c.status === 'golden' || c.status === 'approved').length / all.length) * 100)
        : 0,
    };
  },
};
