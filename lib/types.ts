export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Workspace = {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export type WorkspaceMember = {
  id: string
  workspace_id: string
  user_id: string
  role: "owner" | "admin" | "member" | "viewer"
  created_at: string
  profiles?: Profile
}

export type Board = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string
  board_type: "general" | "experiment"
  created_at: string
  updated_at: string
}

export type Group = {
  id: string
  board_id: string
  name: string
  color: string
  position: number
  created_at: string
  tasks?: Task[]
}

export type TaskCluster = {
  id: string
  board_id: string
  name: string
  color: string
  created_at: string
}

export type ExperimentTaskType =
  | "printing"
  | "thawing"
  | "data_collection_1"
  | "data_collection_2"
  | "data_collection_3"

export type Task = {
  id: string
  group_id: string
  board_id: string
  title: string
  description: string | null
  status: "not_started" | "in_progress" | "done" | "stuck"
  priority: "low" | "medium" | "high" | "critical"
  assignee_id: string | null
  due_date: string | null
  start_date: string | null
  position: number
  experiment_id: string | null
  task_type: ExperimentTaskType | null
  notification_enabled: boolean
  created_at: string
  updated_at: string
  assignee?: Profile
  task_cluster_id?: string | null
  task_clusters?: TaskCluster
}

export type Experiment = {
  id: string
  board_id: string
  name: string
  print_date: string
  status: "active" | "completed" | "cancelled"
  created_at: string
  updated_at: string
}

export type TaskNotification = {
  id: string
  task_id: string
  board_id: string
  workspace_id: string
  notify_date: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type ViewMode = "board" | "table" | "timeline"

export const EXPERIMENT_WORKFLOW = [
  { type: "printing", label: "Printing Day", dayOffset: 0, description: "Initial printing completed" },
  { type: "thawing", label: "Thawing Day", dayOffset: 1, description: "Thawing process begins" },
  {
    type: "data_collection_1",
    label: "Data Collection 1",
    dayOffset: 4,
    description: "First data collection (3 days after thawing)",
  },
  {
    type: "data_collection_2",
    label: "Data Collection 2",
    dayOffset: 6,
    description: "Second data collection (2 days after first)",
  },
  {
    type: "data_collection_3",
    label: "Data Collection 3 (Final)",
    dayOffset: 8,
    description: "Final data collection - Experiment complete",
  },
] as const

export type TaskAssignee = {
  id: string
  task_id: string
  user_id: string
  created_at: string
  profile?: Profile
}

export type TaskComment = {
  id: string
  task_id: string
  user_id: string
  content: string
  link?: boolean
  created_at: string
  updated_at: string
  profile?: Profile
}
