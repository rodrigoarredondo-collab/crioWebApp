-- Create task_clusters table
create table public.task_clusters (
  id uuid not null default gen_random_uuid (),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamp with time zone not null default now(),
  constraint task_clusters_pkey primary key (id)
);

-- Add RLS policies for task_clusters
alter table public.task_clusters enable row level security;

create policy "Users can view task clusters for boards they have access to"
on public.task_clusters for select
using (
  exists (
    select 1 from public.boards
    where boards.id = task_clusters.board_id
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = boards.workspace_id
      and workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Users can insert task clusters for boards they have access to"
on public.task_clusters for insert
with check (
  exists (
    select 1 from public.boards
    where boards.id = task_clusters.board_id
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = boards.workspace_id
      and workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Users can update task clusters for boards they have access to"
on public.task_clusters for update
using (
  exists (
    select 1 from public.boards
    where boards.id = task_clusters.board_id
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = boards.workspace_id
      and workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Users can delete task clusters for boards they have access to"
on public.task_clusters for delete
using (
  exists (
    select 1 from public.boards
    where boards.id = task_clusters.board_id
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = boards.workspace_id
      and workspace_members.user_id = auth.uid()
    )
  )
);

-- Add task_cluster_id to tasks table
alter table public.tasks 
add column task_cluster_id uuid references public.task_clusters (id) on delete set null;
