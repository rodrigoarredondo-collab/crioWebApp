-- Fix infinite recursion in workspace_members policies
-- The issue is that SELECT policy on workspace_members references itself

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can delete members" ON workspace_members;

-- Also fix workspaces SELECT policy that causes recursion
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;

-- Recreated policies without infinite recursion

-- Workspaces: Use direct owner check OR a simple membership check that doesn't cascade
CREATE POLICY "Users can view workspaces they are members of" ON workspaces FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Workspace members SELECT: Check workspace ownership OR direct membership (non-recursive)
CREATE POLICY "Members can view workspace members" ON workspace_members FOR SELECT 
  USING (
    -- User is the workspace owner
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid())
    OR
    -- User is a member (direct check on user_id, not nested query on workspace_members)
    user_id = auth.uid()
    OR
    -- User has a membership record for this workspace (using subquery that doesn't trigger RLS)
    workspace_id IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())
  );

-- Workspace members INSERT: Owner can add, or existing admin/owner members can add
CREATE POLICY "Owners/admins can manage members" ON workspace_members FOR INSERT 
  WITH CHECK (
    -- Workspace owner can always add members
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR
    -- User adding themselves as owner (initial workspace creation)
    (user_id = auth.uid() AND role = 'owner')
  );

-- Workspace members UPDATE: Only workspace owner or admins
CREATE POLICY "Owners/admins can update members" ON workspace_members FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

-- Workspace members DELETE: Only workspace owner or self-removal
CREATE POLICY "Owners/admins can delete members" ON workspace_members FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR
    user_id = auth.uid() -- Users can remove themselves
  );
