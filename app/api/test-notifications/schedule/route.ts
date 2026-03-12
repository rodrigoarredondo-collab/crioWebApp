import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { email, date, message } = await request.json()

    if (!email || !date) {
      return NextResponse.json({ success: false, error: "Email and date are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Create a scheduled test notification
    const { error } = await supabase.from("scheduled_test_notifications").insert({
      email,
      notify_date: date,
      message: message || "Test notification from WorkFlow",
      sent: false,
    })

    if (error) {
      // If table doesn't exist, try to create it
      if (error.code === "42P01") {
        return NextResponse.json({
          success: false,
          error: "Please run the migration script 006-scheduled-test-notifications.sql first",
        })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error scheduling notification:", error)
    return NextResponse.json({ success: false, error: "Failed to schedule notification" }, { status: 500 })
  }
}
