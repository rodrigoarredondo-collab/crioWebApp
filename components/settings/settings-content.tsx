"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Send, Loader2, Bell, Calendar, Mail, Clock } from "lucide-react"

interface SettingsContentProps {
  userEmail: string
}

export function SettingsContent({ userEmail }: SettingsContentProps) {
  const [testEmail, setTestEmail] = useState(userEmail)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [triggeringCron, setTriggeringCron] = useState(false)
  const [cronResult, setCronResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)

  const [scheduleEmail, setScheduleEmail] = useState(userEmail)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleMessage, setScheduleMessage] = useState("Test notification from WorkFlow")
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTestEmail = async () => {
    if (!testEmail) return
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/test-notifications?email=${encodeURIComponent(testEmail)}`)
      const data = await res.json()

      if (data.success) {
        setTestResult({ success: true, message: `Test email sent to ${testEmail}` })
      } else {
        setTestResult({ success: false, message: data.error || data.message || "Failed to send" })
      }
    } catch (err) {
      setTestResult({ success: false, message: "Network error" })
    } finally {
      setTesting(false)
    }
  }

  const handleTriggerCron = async () => {
    setTriggeringCron(true)
    setCronResult(null)

    try {
      const res = await fetch("/api/test-notifications", { method: "POST" })
      const data = await res.json()

      setCronResult({
        success: true,
        message: `Processed ${data.cronResult?.count || 0} notifications`,
        count: data.pendingNotifications,
      })
    } catch (err) {
      setCronResult({ success: false, message: "Failed to trigger cron" })
    } finally {
      setTriggeringCron(false)
    }
  }

  const handleScheduleNotification = async () => {
    if (!scheduleEmail || !scheduleDate) return
    setScheduling(true)
    setScheduleResult(null)

    try {
      const res = await fetch("/api/test-notifications/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: scheduleEmail,
          date: scheduleDate,
          message: scheduleMessage,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setScheduleResult({
          success: true,
          message: `Notification scheduled for ${new Date(scheduleDate).toLocaleDateString()} to ${scheduleEmail}`,
        })
        setScheduleDate("")
        setScheduleMessage("Test notification from WorkFlow")
      } else {
        setScheduleResult({ success: false, message: data.error || "Failed to schedule" })
      }
    } catch (err) {
      setScheduleResult({ success: false, message: "Network error" })
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Email Notifications Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Test your email notification setup. Requires RESEND_API_KEY environment variable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="test-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="your@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleTestEmail} disabled={testing || !testEmail}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Test
              </Button>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}
              >
                {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-foreground mb-2">Setup Instructions</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>
                  Create an account at{" "}
                  <a
                    href="https://resend.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    resend.com
                  </a>
                </li>
                <li>Get your API key from the Resend dashboard</li>
                <li>
                  Add <code className="bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> to your Vercel environment
                  variables (Vars section in v0 sidebar)
                </li>
                <li>Test with the form above</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Test Notification
            </CardTitle>
            <CardDescription>
              Create a specific notification for a specific email on a specific date. Perfect for testing the cron job.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="schedule-email">Recipient Email</Label>
                <Input
                  id="schedule-email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="schedule-date">Notification Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-message">Message (optional)</Label>
              <Input
                id="schedule-message"
                placeholder="Custom message for the notification"
                value={scheduleMessage}
                onChange={(e) => setScheduleMessage(e.target.value)}
              />
            </div>
            <Button onClick={handleScheduleNotification} disabled={scheduling || !scheduleEmail || !scheduleDate}>
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              Schedule Notification
            </Button>

            {scheduleResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${scheduleResult.success ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}
              >
                {scheduleResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="text-sm">{scheduleResult.message}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Tip: Set the date to today, then use "Trigger Now" below to immediately send the notification.
            </p>
          </CardContent>
        </Card>

        {/* Cron Job Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Cron Job
            </CardTitle>
            <CardDescription>
              The cron job runs daily at 8 AM UTC. You can manually trigger it here for testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button onClick={handleTriggerCron} disabled={triggeringCron} variant="outline">
                {triggeringCron ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Trigger Now
              </Button>
              <span className="text-sm text-muted-foreground">Sends all pending notifications for today</span>
            </div>

            {cronResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${cronResult.success ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}
              >
                {cronResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="text-sm">{cronResult.message}</span>
                {cronResult.count !== undefined && (
                  <Badge variant="secondary" className="ml-2">
                    {cronResult.count} pending
                  </Badge>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-foreground mb-2">CRON_SECRET</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Generate a random secret to secure your cron endpoint in production:
              </p>
              <code className="block bg-muted p-3 rounded text-sm font-mono break-all">
                {typeof window !== "undefined" ? crypto.randomUUID() : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Add this as <code className="bg-muted px-1 py-0.5 rounded">CRON_SECRET</code> in your Vercel environment
                variables.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
