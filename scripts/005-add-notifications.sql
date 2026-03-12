-- Add notifications table for task alarms
CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notify_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_task_notifications_notify_date ON task_notifications(notify_date);
CREATE INDEX IF NOT EXISTS idx_task_notifications_sent_at ON task_notifications(sent_at);

-- Enable RLS
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies using helper functions
CREATE POLICY "Users can view notifications for their workspaces"
  ON task_notifications FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can create notifications for their workspaces"
  ON task_notifications FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update notifications for their workspaces"
  ON task_notifications FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete notifications for their workspaces"
  ON task_notifications FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Add notification_enabled column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT FALSE;
