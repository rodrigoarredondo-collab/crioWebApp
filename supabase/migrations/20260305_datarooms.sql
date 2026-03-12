-- ============================================================
-- Datarooms: rooms, files, share links
-- ============================================================

-- 1. datarooms
CREATE TABLE IF NOT EXISTS datarooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_datarooms_owner ON datarooms(owner_id);

-- 2. dataroom_files
CREATE TABLE IF NOT EXISTS dataroom_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataroom_id UUID NOT NULL REFERENCES datarooms(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  storage_path TEXT NOT NULL,          -- path inside Supabase Storage bucket
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_dataroom_files_dataroom ON dataroom_files(dataroom_id);

-- 3. dataroom_share_links
CREATE TABLE IF NOT EXISTS dataroom_share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataroom_id UUID NOT NULL REFERENCES datarooms(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,                           -- optional human-readable label
  access_finance BOOLEAN DEFAULT FALSE,
  access_projects BOOLEAN DEFAULT FALSE,
  access_data BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_share_links_token ON dataroom_share_links(token);
CREATE INDEX idx_share_links_dataroom ON dataroom_share_links(dataroom_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE datarooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_share_links ENABLE ROW LEVEL SECURITY;

-- datarooms: owner-only CRUD
CREATE POLICY "Owners can view their datarooms" ON datarooms
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Owners can create datarooms" ON datarooms
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their datarooms" ON datarooms
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their datarooms" ON datarooms
  FOR DELETE USING (owner_id = auth.uid());

-- dataroom_files: owner of parent dataroom
CREATE POLICY "Owners can view dataroom files" ON dataroom_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_files.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can insert dataroom files" ON dataroom_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_files.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can delete dataroom files" ON dataroom_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_files.dataroom_id AND d.owner_id = auth.uid())
  );

-- dataroom_share_links: owner of parent dataroom
CREATE POLICY "Owners can view share links" ON dataroom_share_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_share_links.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can create share links" ON dataroom_share_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_share_links.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can update share links" ON dataroom_share_links
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_share_links.dataroom_id AND d.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_share_links.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can delete share links" ON dataroom_share_links
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_share_links.dataroom_id AND d.owner_id = auth.uid())
  );

-- Public share access is handled at the API level using the
-- Supabase service role key to bypass RLS (avoids cross-table recursion).
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('dataroom-files', 'dataroom-files', false)
-- ON CONFLICT DO NOTHING;
