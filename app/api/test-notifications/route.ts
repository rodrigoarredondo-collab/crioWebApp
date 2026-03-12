import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { Resend } from "resend"

// Access this at /api/test-notifications?email=your@email.com to test

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testEmail = searchParams.get("email")

  if (!testEmail) {
    return NextResponse.json(
      {
        error: "Missing email parameter",
        usage: "/api/test-notifications?email=your@email.com",
      },
      { status: 400 },
    )
  }

  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        message: "RESEND_API_KEY is not set. Add it to your environment variables.",
        steps: [
          "1. Go to resend.com and create an account",
          "2. Get your API key from the dashboard",
          "3. Add RESEND_API_KEY to your Vercel environment variables (Vars section)",
          "4. Try this endpoint again",
        ],
      },
      { status: 500 },
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    // Send a test email
    const { data, error } = await resend.emails.send({
      from: "WorkFlow <notifications@resend.dev>",
      to: [testEmail],
      subject: "[Test] WorkFlow Notifications Working!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Test Notification</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 12px; color: #111827;">Email notifications are working!</h2>
              <p style="color: #6b7280; margin: 0;">
                This confirms that your Resend integration is properly configured.
                You will receive task reminders at 8 AM on the day they're due.
              </p>
            </div>
            <div style="margin-top: 20px; padding: 16px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>Next steps:</strong><br/>
                1. Create an experiment board<br/>
                2. Click "I Printed Today" to generate tasks<br/>
                3. Tasks will have notifications enabled automatically<br/>
                4. You'll receive emails on each due date
              </p>
            </div>
          </div>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      emailId: data?.id,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  // Use service role key to bypass RLS
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const today = new Date().toISOString().split("T")[0]

  // Get pending notifications for today
  const { data: notifications, error } = await supabase
    .from("task_notifications")
    .select(`
      *,
      task:tasks(id, title, due_date, board:boards(name, workspace_id))
    `)
    .eq("notify_date", today)
    .is("sent_at", null)

  if (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }

  // Trigger the actual cron endpoint
  const cronUrl = new URL("/api/cron/send-notifications", request.url)
  const cronResponse = await fetch(cronUrl.toString(), {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET || "test"}` },
  })
  const cronResult = await cronResponse.json()

  return NextResponse.json({
    pendingNotifications: notifications?.length || 0,
    today,
    cronResult,
  })
}
