-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces (like Monday.com workspaces)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members (team collaboration)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Boards (projects within workspaces)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#0073ea',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups (columns/sections in boards like "To Do", "In Progress")
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#579bfc',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (items within groups)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'stuck')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  start_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Workspaces policies
CREATE POLICY "Users can view workspaces they are members of" ON workspaces FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create workspaces" ON workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update workspaces" ON workspaces FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete workspaces" ON workspaces FOR DELETE USING (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Members can view workspace members" ON workspace_members FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid())
  );
CREATE POLICY "Owners/admins can manage members" ON workspace_members FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );
CREATE POLICY "Owners/admins can update members" ON workspace_members FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );
CREATE POLICY "Owners/admins can delete members" ON workspace_members FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );

-- Boards policies
CREATE POLICY "Members can view boards" ON boards FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = boards.workspace_id AND wm.user_id = auth.uid())
  );
CREATE POLICY "Members can create boards" ON boards FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = boards.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member'))
  );
CREATE POLICY "Members can update boards" ON boards FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = boards.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member'))
  );
CREATE POLICY "Admins can delete boards" ON boards FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = boards.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );

-- Groups policies
CREATE POLICY "Members can view groups" ON groups FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = groups.board_id AND wm.user_id = auth.uid()
    )
  );
CREATE POLICY "Members can create groups" ON groups FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = groups.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );
CREATE POLICY "Members can update groups" ON groups FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = groups.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );
CREATE POLICY "Members can delete groups" ON groups FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = groups.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );

-- Tasks policies
CREATE POLICY "Members can view tasks" ON tasks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = tasks.board_id AND wm.user_id = auth.uid()
    )
  );
CREATE POLICY "Members can create tasks" ON tasks FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = tasks.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );
CREATE POLICY "Members can update tasks" ON tasks FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = tasks.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );
CREATE POLICY "Members can delete tasks" ON tasks FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id 
      WHERE b.id = tasks.board_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'member')
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
