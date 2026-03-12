import { createClient } from "@/lib/supabase/client"
import type { TaskCluster } from "@/lib/types"

export async function getTaskClusters(boardId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("task_clusters")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Error fetching task clusters:", error)
        return []
    }

    return data as TaskCluster[]
}

export async function createTaskCluster(cluster: Omit<TaskCluster, "id" | "created_at">) {
    const supabase = createClient()
    const { data, error } = await supabase.from("task_clusters").insert(cluster).select().single()

    if (error) {
        throw error
    }

    return data as TaskCluster
}

export async function updateTaskCluster(id: string, updates: Partial<TaskCluster>) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("task_clusters")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

    if (error) {
        throw error
    }

    return data as TaskCluster
}

export async function deleteTaskCluster(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("task_clusters").delete().eq("id", id)

    if (error) {
        throw error
    }
}
