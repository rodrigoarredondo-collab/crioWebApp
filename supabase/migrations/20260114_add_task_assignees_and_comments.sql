-- Create task_assignees table for multi-assignee support
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(task_id, user_id)
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_assignees
CREATE POLICY "Users can view task assignees for tasks in their workspaces" ON task_assignees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN boards b ON t.board_id = b.id
      JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert task assignees for tasks in their workspaces" ON task_assignees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN boards b ON t.board_id = b.id
      JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete task assignees for tasks in their workspaces" ON task_assignees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN boards b ON t.board_id = b.id
      JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments for tasks in their workspaces" ON task_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN boards b ON t.board_id = b.id
      JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
      WHERE t.id = task_comments.task_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments for tasks in their workspaces" ON task_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN boards b ON t.board_id = b.id
      JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
      WHERE t.id = task_comments.task_id AND wm.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments" ON task_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON task_comments
  FOR DELETE
  USING (user_id = auth.uid());
