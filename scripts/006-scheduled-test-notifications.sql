-- Create table for scheduled test notifications
CREATE TABLE IF NOT EXISTS scheduled_test_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  notify_date DATE NOT NULL,
  message TEXT DEFAULT 'Test notification from WorkFlow',
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scheduled_test_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create test notifications
CREATE POLICY "Users can create test notifications"
  ON scheduled_test_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow reading all test notifications (for cron job)
CREATE POLICY "Allow reading test notifications"
  ON scheduled_test_notifications FOR SELECT
  TO authenticated
  USING (true);

-- Allow updating test notifications (for marking as sent)
CREATE POLICY "Allow updating test notifications"
  ON scheduled_test_notifications FOR UPDATE
  TO authenticated
  USING (true);
