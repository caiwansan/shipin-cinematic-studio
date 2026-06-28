import { z } from 'zod'

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(6).max(100),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// Project Schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
})

// Storyboard Schemas
export const createStoryboardSchema = z.object({
  shotIndex: z.number().int().min(0),
  duration: z.number().optional(),
  shotType: z.string().optional(),
  subject: z.string().optional(),
  action: z.string().optional(),
  expression: z.string().optional(),
  cameraMovement: z.string().optional(),
  lens: z.string().optional(),
  lighting: z.string().optional(),
  emotion: z.string().optional(),
  environment: z.string().optional(),
  cinematicStyle: z.string().optional(),
  colorStyle: z.string().optional(),
  realism: z.boolean().optional(),
  motionBlur: z.boolean().optional(),
  continuityNotes: z.string().optional(),
  negativePrompt: z.string().optional(),
  startFrame: z.number().int().optional(),
  endFrame: z.number().int().optional(),
})

// Character Schemas
export const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().optional(),
  gender: z.string().optional(),
  face: z.string().optional(),
  hair: z.string().optional(),
  clothes: z.string().optional(),
  body: z.string().optional(),
  identity: z.string().optional(),
  speakingStyle: z.string().optional(),
  personality: z.string().optional(),
})

// Scene Schemas
export const createSceneSchema = z.object({
  location: z.string().optional(),
  architecture: z.string().optional(),
  weather: z.string().optional(),
  lighting: z.string().optional(),
  timeOfDay: z.string().optional(),
  atmosphere: z.string().optional(),
  colorPalette: z.string().optional(),
  referenceImage: z.string().optional(),
})

// Task Schemas
export const createTaskSchema = z.object({
  storyboardId: z.string().uuid().optional(),
})
