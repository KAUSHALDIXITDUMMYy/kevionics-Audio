"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { RealTimeStreams } from "@/components/subscriber/real-time-streams"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Monitor, LogOut } from "lucide-react"

export default function SubscriberDashboard() {
  const { userProfile } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <ProtectedRoute allowedRoles={["subscriber"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Monitor className="h-6 w-6" />
                <div>
                  <h1 className="text-2xl font-bold">Subscriber Dashboard</h1>
                  <p className="text-muted-foreground">
                    Welcome back, {userProfile?.displayName || userProfile?.email}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <RealTimeStreams />
        </main>
      </div>
    </ProtectedRoute>
  )
}
