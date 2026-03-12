import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"

// This endpoint is meant to be called by a cron job (e.g., Vercel Cron)
// Add to vercel.json: { "crons": [{ "path": "/api/cron/send-notifications", "schedule": "0 8 * * *" }] }

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if no CRON_SECRET is set
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Use service role key to bypass RLS
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const today = new Date().toISOString().split("T")[0]
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  const results: { type: string; id: string; emails: string[]; success: boolean; error?: string }[] = []

  try {
    const { data: testNotifications, error: testError } = await supabase
      .from("scheduled_test_notifications")
      .select("*")
      .eq("notify_date", today)
      .eq("sent", false)

    if (!testError && testNotifications && testNotifications.length > 0) {
      for (const testNotif of testNotifications) {
        try {
          if (resend) {
            await resend.emails.send({
              from: "WorkFlow <notifications@resend.dev>",
              to: [testNotif.email],
              subject: `[WorkFlow Test] Scheduled Notification`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Test Notification</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                      <p style="color: #111827; font-size: 16px; margin: 0;">${testNotif.message}</p>
                      <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
                        Scheduled for: ${new Date(testNotif.notify_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
                      This is a test notification from WorkFlow.
                    </p>
                  </div>
                </div>
              `,
            })
            console.log(`[Test Notification] Email sent to ${testNotif.email}`)
          } else {
            console.log(`[Test Notification] Would send to: ${testNotif.email}`)
            console.log(`[Test Notification] Message: ${testNotif.message}`)
            console.log(`[Test Notification] Note: Set RESEND_API_KEY to send actual emails`)
          }

          // Mark as sent
          await supabase
            .from("scheduled_test_notifications")
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq("id", testNotif.id)

          results.push({ type: "test", id: testNotif.id, emails: [testNotif.email], success: true })
        } catch (emailError) {
          console.error("Error sending test notification:", emailError)
          results.push({
            type: "test",
            id: testNotif.id,
            emails: [testNotif.email],
            success: false,
            error: emailError instanceof Error ? emailError.message : "Unknown error",
          })
        }
      }
    }
  } catch (err) {
    console.log("Scheduled test notifications table may not exist yet, skipping...")
  }

  // Process regular task notifications
  const { data: notifications, error: notifError } = await supabase
    .from("task_notifications")
    .select(`
      *,
      task:tasks(
        id,
        title,
        description,
        due_date,
        task_type,
        board:boards(
          id,
          name,
          workspace_id
        )
      )
    `)
    .eq("notify_date", today)
    .is("sent_at", null)

  if (notifError) {
    console.error("Error fetching notifications:", notifError)
    return NextResponse.json({ error: "Failed to fetch notifications", testResults: results }, { status: 500 })
  }

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({
      message: "Notifications processed",
      taskCount: 0,
      testCount: results.filter((r) => r.type === "test").length,
      results,
    })
  }

  for (const notification of notifications) {
    const task = notification.task as {
      id: string
      title: string
      description: string | null
      due_date: string | null
      task_type: string | null
      board: { id: string; name: string; workspace_id: string }
    }

    if (!task || !task.board) continue

    // Get all workspace members to notify
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id, profiles(email, full_name)")
      .eq("workspace_id", task.board.workspace_id)

    if (membersError || !members) {
      console.error("Error fetching workspace members:", membersError)
      continue
    }

    // Collect emails
    const emails = members
      .map((m) => (m.profiles as unknown as { email: string; full_name: string | null })?.email)
      .filter(Boolean)

    if (emails.length === 0) continue

    try {
      if (resend) {
        const taskTypeLabel = task.task_type
          ? task.task_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          : "Task"

        await resend.emails.send({
          from: "WorkFlow <notifications@resend.dev>",
          to: emails,
          subject: `[Due Today] ${task.title} - ${task.board.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Task Due Today</h1>
              </div>
              <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <span style="background: #ede9fe; color: #7c3aed; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                    ${taskTypeLabel}
                  </span>
                  <h2 style="margin: 12px 0 8px; color: #111827; font-size: 20px;">${task.title}</h2>
                  ${task.description ? `<p style="color: #6b7280; margin: 0 0 16px;">${task.description}</p>` : ""}
                  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      <strong>Board:</strong> ${task.board.name}<br/>
                      <strong>Due Date:</strong> ${new Date(task.due_date!).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
                  You're receiving this because you're a member of this workspace.
                </p>
              </div>
            </div>
          `,
        })
        console.log(`[Notification] Email sent for task "${task.title}" to ${emails.length} recipients`)
      } else {
        console.log(`[Notification] Task "${task.title}" is due today!`)
        console.log(`[Notification] Would send to: ${emails.join(", ")}`)
        console.log(`[Notification] Board: ${task.board.name}`)
        console.log(`[Notification] Note: Set RESEND_API_KEY to send actual emails`)
      }

      // Mark notification as sent
      await supabase.from("task_notifications").update({ sent_at: new Date().toISOString() }).eq("id", notification.id)

      results.push({ type: "task", id: task.id, emails, success: true })
    } catch (emailError) {
      console.error("Error sending email:", emailError)
      results.push({
        type: "task",
        id: task.id,
        emails,
        success: false,
        error: emailError instanceof Error ? emailError.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({
    message: "Notifications processed",
    taskCount: notifications.length,
    testCount: results.filter((r) => r.type === "test").length,
    results,
  })
}
