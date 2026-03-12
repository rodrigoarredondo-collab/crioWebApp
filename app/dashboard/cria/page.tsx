import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CriaChatWrapper } from "@/components/dashboard/cria-chat-wrapper";

export default async function CriaPage() {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/auth/login");
    }

    // Same permission model as before
    if (!user.email?.endsWith("@criocore.com")) {
        redirect("/dashboard");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <DashboardShell user={user} profile={profile}>
            <CriaChatWrapper />
        </DashboardShell>
    );
}
