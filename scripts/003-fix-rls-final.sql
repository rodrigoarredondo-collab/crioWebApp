-- FINAL FIX: Eliminate infinite recursion by using security definer functions
-- These functions bypass RLS and can safely query workspace_members

-- Create a security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a security definer function to check workspace ownership
CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = ws_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to get user's workspace IDs
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop ALL existing policies on workspaces and workspace_members
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners can update workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners can delete workspaces" ON workspaces;

DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Owners/admins can delete members" ON workspace_members;

-- Recreate workspaces policies using security definer functions
CREATE POLICY "Users can view owned workspaces" ON workspaces FOR SELECT 
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view member workspaces" ON workspaces FOR SELECT 
  USING (id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can create workspaces" ON workspaces FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update workspaces" ON workspaces FOR UPDATE 
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete workspaces" ON workspaces FOR DELETE 
  USING (owner_id = auth.uid());

-- Recreate workspace_members policies using security definer functions
CREATE POLICY "Users can view own membership" ON workspace_members FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can view co-members" ON workspace_members FOR SELECT 
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Owners can insert members" ON workspace_members FOR INSERT 
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Users can add self as owner" ON workspace_members FOR INSERT 
  WITH CHECK (user_id = auth.uid() AND role = 'owner');

CREATE POLICY "Owners can update members" ON workspace_members FOR UPDATE 
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can delete members" ON workspace_members FOR DELETE 
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Users can leave workspace" ON workspace_members FOR DELETE 
  USING (user_id = auth.uid());

-- Also update boards, groups, tasks to use the security definer function
DROP POLICY IF EXISTS "Members can view boards" ON boards;
DROP POLICY IF EXISTS "Members can create boards" ON boards;
DROP POLICY IF EXISTS "Members can update boards" ON boards;
DROP POLICY IF EXISTS "Admins can delete boards" ON boards;

CREATE POLICY "Members can view boards" ON boards FOR SELECT 
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create boards" ON boards FOR INSERT 
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update boards" ON boards FOR UPDATE 
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete boards" ON boards FOR DELETE 
  USING (public.is_workspace_owner(workspace_id));

-- Update groups policies
DROP POLICY IF EXISTS "Members can view groups" ON groups;
DROP POLICY IF EXISTS "Members can create groups" ON groups;
DROP POLICY IF EXISTS "Members can update groups" ON groups;
DROP POLICY IF EXISTS "Members can delete groups" ON groups;

CREATE POLICY "Members can view groups" ON groups FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = groups.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can create groups" ON groups FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = groups.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can update groups" ON groups FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = groups.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can delete groups" ON groups FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = groups.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

-- Update tasks policies  
DROP POLICY IF EXISTS "Members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Members can update tasks" ON tasks;
DROP POLICY IF EXISTS "Members can delete tasks" ON tasks;

CREATE POLICY "Members can view tasks" ON tasks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = tasks.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can create tasks" ON tasks FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = tasks.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can update tasks" ON tasks FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = tasks.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Members can delete tasks" ON tasks FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.id = tasks.board_id AND public.is_workspace_member(b.workspace_id)
    )
  );
