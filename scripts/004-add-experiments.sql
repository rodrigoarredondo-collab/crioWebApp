-- Add experiment support to boards
-- This script adds an experiment_type column to boards and an experiment_id to tasks

-- Add board type column
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_type TEXT DEFAULT 'general';

-- Add experiment tracking to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS experiment_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT;

-- Create experiments table to track individual experiments
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  print_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on experiments
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

-- RLS policies for experiments (uses the same workspace access pattern)
CREATE POLICY "experiments_select" ON experiments
  FOR SELECT
  USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "experiments_insert" ON experiments
  FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT id FROM boards 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "experiments_update" ON experiments
  FOR UPDATE
  USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "experiments_delete" ON experiments
  FOR DELETE
  USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
