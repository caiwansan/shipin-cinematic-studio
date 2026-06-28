export interface NarrativeCharacter {
  id: string
  name: string
  description?: string
  personality?: string
  appearance?: string
}

export interface NarrativeScene {
  id: string
  name: string
  description?: string
  mood?: string
  type?: string
  timeOfDay?: string
  lighting?: string
  colorTone?: string
  keyProps?: string | string[]
  environment?: string
}

export interface NarrativeDialogue {
  id: string
  characterId?: string
  content: string
  segmentId?: string
}

export interface NarrativeAction {
  id: string
  description: string
  segmentId?: string
}

export interface NarrativeProp {
  id: string
  name: string
  category: string
  description?: string
  relatedSceneIds?: string[]
  imagePrompt?: string
  metadata?: {
    source?: string
    confidence?: number
  }
}

export interface NarrativeBeat {
  start?: number
  end?: number
  camera?: string
  visual?: string
  dialogue?: string
  effect?: string
  sound?: string
  emotion?: string
  label?: string
}

export interface NarrativeVideoSegment {
  id: string | number
  title?: string
  scene?: string
  duration?: number
  beats?: NarrativeBeat[]
  characters?: string[]
  transition?: string
  dialogues?: NarrativeDialogue[]
  actions?: NarrativeAction[]
}

export interface NarrativeSpec {
  title?: string
  synopsis?: string
  characters: NarrativeCharacter[]
  scenes: NarrativeScene[]
  props: NarrativeProp[]
  videoSegments: NarrativeVideoSegment[]
  beats?: unknown[]
  dialogues?: NarrativeDialogue[]
  actions?: NarrativeAction[]
  voices?: unknown[]
  emotionCurve?: unknown
}
