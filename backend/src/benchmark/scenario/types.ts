/**
 * Scenario Library Type Definitions
 *
 * P0-T002 — Scenario Library Foundation
 * 三层模型: Industry → Scenario → Intent
 */

export interface Intent {
  id: string;
  name: string;
  description: string;
  /** 自然表达，至少 3 条 */
  naturalExpressions: string[];
  /** 代表性问题，至少 2 条 */
  representativeQuestions: string[];
}

export interface Scenario {
  id: string;
  industryId: string;
  name: string;
  description: string;
  intents: Intent[];
}

export interface Industry {
  id: string;
  name: string;
  displayName: string;
}
