-- Add variant column to ai_character_specs
ALTER TABLE ai_character_specs ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';

-- Add variant column to character_images
ALTER TABLE character_images ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';

-- Drop old unique constraint on character_images (projectId, sortOrder)
ALTER TABLE character_images DROP CONSTRAINT IF EXISTS "character_images_projectId_sortOrder_key";

-- Add new unique constraints
ALTER TABLE character_images ADD CONSTRAINT character_images_pid_cname_variant_key UNIQUE ("projectId", "characterName", variant);
ALTER TABLE ai_character_specs ADD CONSTRAINT ai_character_specs_pid_name_variant_key UNIQUE ("projectId", "characterName", variant);
