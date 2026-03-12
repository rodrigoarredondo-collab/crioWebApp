-- Add expires_at column to dataroom_share_links

ALTER TABLE dataroom_share_links
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
