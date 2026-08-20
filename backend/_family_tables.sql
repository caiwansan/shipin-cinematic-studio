CREATE TABLE IF NOT EXISTS family_member (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  group_id TEXT NOT NULL,
  uid TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  generation INT NOT NULL DEFAULT 0,
  clan_role TEXT NOT NULL DEFAULT '',
  lit BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT 0,
  UNIQUE(group_id, uid)
);
CREATE TABLE IF NOT EXISTS family_archive (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  group_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'clan_history',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  uid TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL DEFAULT 0
);
