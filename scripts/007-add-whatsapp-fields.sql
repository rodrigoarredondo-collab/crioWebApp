-- Add phone_number to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add incomplete_reason to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;

-- Add whatsapp_sent_at to task_notifications to track separately from email
ALTER TABLE task_notifications ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- Comment for clarity
COMMENT ON COLUMN profiles.phone_number IS 'WhatsApp phone number in international format (e.g., +1234567890)';
COMMENT ON COLUMN tasks.incomplete_reason IS 'Reason provided by the user via WhatsApp when a task is not completed';
