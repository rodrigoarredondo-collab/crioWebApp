-- ============================================================
-- Datarooms Refactor: Global Files & Single Share Link
-- ============================================================

-- 1. Create global_files table
CREATE TABLE IF NOT EXISTS global_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_global_files_uploaded_by ON global_files(uploaded_by);

-- 2. Create dataroom_attached_files junction table
CREATE TABLE IF NOT EXISTS dataroom_attached_files (
  dataroom_id UUID NOT NULL REFERENCES datarooms(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES global_files(id) ON DELETE CASCADE,
  attached_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (dataroom_id, file_id)
);

CREATE INDEX idx_dataroom_attached_files_dataroom ON dataroom_attached_files(dataroom_id);
CREATE INDEX idx_dataroom_attached_files_file ON dataroom_attached_files(file_id);

-- 3. RLS for global_files
ALTER TABLE global_files ENABLE ROW LEVEL SECURITY;

-- Assuming any user can see files they uploaded OR files attached to datarooms they own, 
-- but for simplicity, let's allow all authenticated users in a workspace context to view.
-- Here, owner viewing their own uploads is the baseline:
CREATE POLICY "Users can view files they uploaded" ON global_files
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert their own files" ON global_files
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own files" ON global_files
  FOR DELETE USING (uploaded_by = auth.uid());

-- 4. RLS for dataroom_attached_files
ALTER TABLE dataroom_attached_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view attached files" ON dataroom_attached_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_attached_files.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can attach files" ON dataroom_attached_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_attached_files.dataroom_id AND d.owner_id = auth.uid())
  );

CREATE POLICY "Owners can detach files" ON dataroom_attached_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM datarooms d WHERE d.id = dataroom_attached_files.dataroom_id AND d.owner_id = auth.uid())
  );

-- 5. Migrate existing dataroom_files to global_files and dataroom_attached_files
INSERT INTO global_files (id, file_name, file_size, mime_type, storage_path, uploaded_by, created_at)
SELECT id, file_name, file_size, mime_type, storage_path, uploaded_by, created_at
FROM dataroom_files
ON CONFLICT DO NOTHING;

INSERT INTO dataroom_attached_files (dataroom_id, file_id, attached_at)
SELECT dataroom_id, id, created_at
FROM dataroom_files
ON CONFLICT DO NOTHING;

-- Note: We will leave `dataroom_files` alone for now to avoid dropping data during transition,
-- but the application will solely read from `global_files` and `dataroom_attached_files`.
