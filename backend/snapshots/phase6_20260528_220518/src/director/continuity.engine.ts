/**
 * Continuity Engine
 *
 * 确保全剧视觉一致性：
 * - 角色一致性（同角色不同镜头形象统一）
 * - 场景连续性（同场景不同角度光线氛围一致）
 * - 镜头衔接（相邻镜头无跳接）
 * - 服装 continuity（角色服装不漂移）
 * - 光线 continuity（场景光线不跳变）
 *
 * 禁止：
 * - 同角色不同脸
 * - 场景漂移
 * - 情绪跳变
 */

import type { CharacterBible, CharacterEntry } from './character-director.agent.js'
import type { SceneAtmosphereDesign, AtmosphereEntry } from './scene-atmosphere.agent.js'

// ============================================================
// Continuity Report
// ============================================================

export interface ContinuityReport {
  valid: boolean
  characterIssues: ContinuityIssue[]
  sceneIssues: ContinuityIssue[]
  shotTransitionIssues: ContinuityIssue[]
  warnings: string[]
}

export interface ContinuityIssue {
  type: 'character_inconsistency' | 'scene_drift' | 'shot_break' | 'costume_break' | 'lighting_shift'
  severity: 'low' | 'medium' | 'high'
  description: string
  suggestion: string
}

// ============================================================
// Continuity Engine
// ============================================================

class ContinuityEngine {
  private activeCharacters = new Map<string, CharacterEntry>()
  private activeScenes = new Map<string, AtmosphereEntry>()
  private lastShot: any = null

  /**
   * 注册角色 Bible
   */
  registerCharacterBible(bible: CharacterBible): void {
    for (const char of bible.characters) {
      this.activeCharacters.set(char.characterId, char)
    }
  }

  /**
   * 注册场景氛围
   */
  registerSceneAtmosphere(design: SceneAtmosphereDesign): void {
    for (const scene of design.scenes) {
      this.activeScenes.set(scene.sceneId, scene)
    }
  }

  /**
   * 检查镜头连续性
   */
  checkShotContinuity(shot: any, sceneId: string): ContinuityReport {
    const issues: ContinuityIssue[] = []
    const warnings: string[] = []

    // 1. 检查相邻镜头跳接
    if (this.lastShot) {
      const sameType = shot.shotType === this.lastShot.shotType
      const sameAngle = shot.cameraMotion === this.lastShot.cameraMotion
      if (sameType && sameAngle) {
        issues.push({
          type: 'shot_break',
          severity: 'medium',
          description: `相邻镜头类型相同（${shot.shotType}），可能产生跳接`,
          suggestion: '改变景别或机位角度以避免跳接',
        })
      }

      // 镜头景别跳跃太大
      const shotOrder = ['extreme_wide', 'wide', 'full', 'medium', 'medium_close_up', 'close_up', 'extreme_close_up']
      const prevIdx = shotOrder.indexOf(this.lastShot.shotType)
      const currIdx = shotOrder.indexOf(shot.shotType)
      if (prevIdx !== -1 && currIdx !== -1 && Math.abs(currIdx - prevIdx) > 3) {
        warnings.push(`景别跳跃过大: ${this.lastShot.shotType} → ${shot.shotType}`)
      }
    }

    // 2. 检查场景光线的 scene continuity
    const scene = this.activeScenes.get(sceneId)
    if (scene) {
      if (shot.lighting && scene.lightingDescription && !shot.lighting.includes(scene.lightingDescription.slice(0, 5))) {
        warnings.push(`镜头光线与场景设定不一致: shot=${shot.lighting}, scene=${scene.lightingDescription}`)
      }
    }

    // 3. 检查角色一致性（如果有角色信息 in shot）
    if (shot.characters) {
      for (const charId of shot.characters) {
        const charBible = this.activeCharacters.get(charId)
        if (charBible) {
          // 检查角色关键特征是否在 shot description 中体现
          for (const keyword of charBible.consistentLookKeywords) {
            if (!shot.description?.includes(keyword)) {
              warnings.push(`角色 ${charBible.name} 的特征"${keyword}"未在镜头描述中体现`)
            }
          }
        }
      }
    }

    this.lastShot = shot

    return {
      valid: issues.length === 0,
      characterIssues: issues.filter(i => i.type === 'character_inconsistency'),
      sceneIssues: issues.filter(i => i.type === 'scene_drift' || i.type === 'lighting_shift'),
      shotTransitionIssues: issues.filter(i => i.type === 'shot_break' || i.type === 'costume_break'),
      warnings,
    }
  }

  /**
   * 为镜头描述注入 continuity 关键词
   */
  injectContinuity(shotDescription: string, characterId?: string, sceneId?: string): string {
    let enhanced = shotDescription

    // 注入角色视觉签名
    if (characterId) {
      const char = this.activeCharacters.get(characterId)
      if (char?.visualSignature) {
        enhanced += `, ${char.visualSignature}`
      }
    }

    // 注入场景氛围关键词
    if (sceneId) {
      const scene = this.activeScenes.get(sceneId)
      if (scene?.atmosphereVisualKeywords) {
        enhanced += `, ${scene.atmosphereVisualKeywords.slice(0, 2).join(', ')}`
      }
    }

    return enhanced
  }

  /**
   * 重置 continuity 状态
   */
  reset(): void {
    this.activeCharacters.clear()
    this.activeScenes.clear()
    this.lastShot = null
  }

  /**
   * 获取当前 Continuity Report（未做镜头检测时的默认报告）
   */
  getStatus(): ContinuityReport {
    return {
      valid: true,
      characterIssues: [],
      sceneIssues: [],
      shotTransitionIssues: [],
      warnings: [],
    }
  }
}

export const continuityEngine = new ContinuityEngine()
