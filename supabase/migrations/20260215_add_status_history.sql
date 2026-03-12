-- Add status_history column to venture_feedback table
ALTER TABLE public.venture_feedback
ADD COLUMN status_history JSONB DEFAULT '[]'::jsonb;

-- Backfill status_history with current status for existing records
UPDATE public.venture_feedback
SET status_history = jsonb_build_array(
    jsonb_build_object(
        'status', status,
        'date', COALESCE(updated_at, created_at),
        'description', 'Initial status migration',
        'contacts', '[]'::jsonb
    )
)
WHERE status IS NOT NULL;
