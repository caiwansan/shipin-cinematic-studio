// ─── Sprint-10C: CareerIdentityProfile 数据库操作 ───
import { PrismaClient } from '@prisma/client'
import {
  CareerIdentityProfile,
  createEmptyProfile,
  IdentityProfileConfirmedFact,
  IdentityProfileSkill,
  IdentityProfileWorkExperience,
  IdentityProfileProject,
  IdentityProfileCareer,
  IdentityProfileLocation,
  IdentityProfileEducation,
  IdentityProfileIdentity,
  IdentityProfileJobPreference,
} from './types'

const prisma = new PrismaClient()

/**
 * Prisma 行 → 类型化 CareerIdentityProfile
 */
function rowToProfile(row: any): CareerIdentityProfile {
  const parse = <T>(v: unknown, def: T): T => {
    if (!v) return def
    if (typeof v === 'object') return v as T
    try { return JSON.parse(String(v)) as T } catch { return def }
  }
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    identity: parse<IdentityProfileIdentity>(row.identity, { name: null, age: null, gender: null }),
    location: parse<IdentityProfileLocation>(row.location, { currentCity: null, preferredCities: [] }),
    education: parse<IdentityProfileEducation>(row.education, { degree: null, school: null, major: null }),
    career: parse<IdentityProfileCareer>(row.career, { currentStatus: null, targetPosition: null, targetIndustry: null, yearsExperience: null, careerDirection: null }),
    skills: parse<IdentityProfileSkill[]>(row.skills, []),
    workExperience: parse<IdentityProfileWorkExperience[]>(row.work_experience, []),
    projects: parse<IdentityProfileProject[]>(row.projects, []),
    jobPreference: parse<IdentityProfileJobPreference>(row.job_preference, { salary: null, location: null, remote: false }),
    confirmedFacts: parse<IdentityProfileConfirmedFact[]>(row.confirmed_facts, []),
    missingFields: row.missing_fields || [],
    completionScore: row.completion_score || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 获取用户的 CareerIdentityProfile
 * 不存在则自动创建
 */
export async function getOrCreateProfile(userId: string): Promise<CareerIdentityProfile> {
  const row = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM career_identity_profiles WHERE user_id = $1::uuid`,
    userId
  )
  if (row && row.length > 0) {
    return rowToProfile(row[0])
  }
  // 不存在 → 创建
  await prisma.$executeRawUnsafe(
    `INSERT INTO career_identity_profiles (user_id) VALUES ($1::uuid)`,
    userId
  )
  const newRow = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM career_identity_profiles WHERE user_id = $1::uuid`,
    userId
  )
  return rowToProfile(newRow[0])
}

/**
 * 更新 Profile 中的某个 JSON 字段
 */
export async function updateProfileField(
  userId: string,
  field: string,
  value: any
): Promise<void> {
  // field: identity, location, education, career, skills, work_experience, projects, job_preference, confirmed_facts
  const safeFields = new Set([
    'identity', 'location', 'education', 'career',
    'skills', 'work_experience', 'projects', 'job_preference',
    'confirmed_facts',
  ])
  if (!safeFields.has(field)) {
    throw new Error(`Invalid field: ${field}. Allowed: ${[...safeFields].join(', ')}`)
  }
  await prisma.$executeRawUnsafe(
    `UPDATE career_identity_profiles SET ${field} = $1::jsonb, updated_at = NOW() WHERE user_id = $2::uuid`,
    JSON.stringify(value),
    userId
  )
}

/**
 * 更新 Profile 标量字段
 */
export async function updateProfileScalars(
  userId: string,
  updates: { status?: string; missing_fields?: string[]; completion_score?: number }
): Promise<void> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1
  if (updates.status !== undefined) {
    sets.push(`status = $${idx}`)
    params.push(updates.status)
    idx++
  }
  if (updates.missing_fields !== undefined) {
    sets.push(`missing_fields = $${idx}::text[]`)
    params.push(updates.missing_fields)
    idx++
  }
  if (updates.completion_score !== undefined) {
    sets.push(`completion_score = $${idx}`)
    params.push(updates.completion_score)
    idx++
  }
  if (sets.length === 1) return // only updated_at, nothing to update
  params.push(userId)
  await prisma.$executeRawUnsafe(
    `UPDATE career_identity_profiles SET ${sets.join(', ')} WHERE user_id = $${idx}::uuid`,
    ...params
  )
}

/**
 * 批量更新 Profile（事务安全）
 */
export async function updateProfile(
  userId: string,
  profile: CareerIdentityProfile
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE career_identity_profiles
     SET identity = $1::jsonb,
         location = $2::jsonb,
         education = $3::jsonb,
         career = $4::jsonb,
         skills = $5::jsonb,
         work_experience = $6::jsonb,
         projects = $7::jsonb,
         job_preference = $8::jsonb,
         confirmed_facts = $9::jsonb,
         missing_fields = $10::text[],
         completion_score = $11,
         status = $12,
         updated_at = NOW()
     WHERE user_id = $13::uuid`,
    JSON.stringify(profile.identity),
    JSON.stringify(profile.location),
    JSON.stringify(profile.education),
    JSON.stringify(profile.career),
    JSON.stringify(profile.skills),
    JSON.stringify(profile.workExperience),
    JSON.stringify(profile.projects),
    JSON.stringify(profile.jobPreference),
    JSON.stringify(profile.confirmedFacts),
    profile.missingFields,
    profile.completionScore,
    profile.status,
    userId
  )
}
