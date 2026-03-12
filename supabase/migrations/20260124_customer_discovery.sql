-- Customer Discovery Schema Migration
-- Creates tables for ICPs, Discovery Sessions, and Leads

-- ============================================================================
-- Ideal Customer Profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS ideal_customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  target_roles TEXT[] DEFAULT '{}',
  company_size TEXT,
  geography TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  scoring_criteria JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_icp_workspace_id ON ideal_customer_profiles(workspace_id);

-- ============================================================================
-- Discovery Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  icp_id UUID REFERENCES ideal_customer_profiles(id) ON DELETE SET NULL,
  target_count INTEGER NOT NULL DEFAULT 10,
  current_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'icp_draft', 'icp_review', 'researching', 'validating', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  request_summary TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_session_workspace_id ON discovery_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_status ON discovery_sessions(status);

-- ============================================================================
-- Leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES discovery_sessions(id) ON DELETE CASCADE,
  icp_id UUID REFERENCES ideal_customer_profiles(id) ON DELETE SET NULL,
  
  -- Personal Info
  full_name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  industry TEXT,
  
  -- Contact Info
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  website TEXT,
  
  -- Scoring
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_breakdown JSONB DEFAULT '{}',
  
  -- Metadata
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'needs_review')),
  source TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leads lookups
CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_icp_id ON leads(icp_id);
CREATE INDEX IF NOT EXISTS idx_leads_validation_status ON leads(validation_status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company);

-- Full-text search on lead name and company
CREATE INDEX IF NOT EXISTS idx_leads_fulltext ON leads USING gin(to_tsvector('english', full_name || ' ' || COALESCE(company, '')));

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ideal_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ICP policies (workspace members can access)
CREATE POLICY "Users can view ICPs in their workspaces" ON ideal_customer_profiles
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create ICPs in their workspaces" ON ideal_customer_profiles
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ICPs in their workspaces" ON ideal_customer_profiles
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ICPs they created" ON ideal_customer_profiles
  FOR DELETE USING (
    created_by = auth.uid() OR
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Session policies
CREATE POLICY "Users can view sessions in their workspaces" ON discovery_sessions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions in their workspaces" ON discovery_sessions
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions in their workspaces" ON discovery_sessions
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Lead policies (based on session access)
CREATE POLICY "Users can view leads from their sessions" ON leads
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM discovery_sessions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create leads in their sessions" ON leads
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM discovery_sessions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update leads in their sessions" ON leads
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM discovery_sessions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete leads in their sessions" ON leads
  FOR DELETE USING (
    session_id IN (
      SELECT id FROM discovery_sessions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_icp_updated_at
  BEFORE UPDATE ON ideal_customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_updated_at
  BEFORE UPDATE ON discovery_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
