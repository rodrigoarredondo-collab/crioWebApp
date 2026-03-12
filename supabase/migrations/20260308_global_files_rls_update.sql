-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view files they uploaded" ON global_files;

-- Create a new policy allowing any authenticated user to view the global files
CREATE POLICY "All authenticated users can view files" ON global_files
  FOR SELECT TO authenticated USING (true);
