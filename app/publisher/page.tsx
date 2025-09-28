"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { StreamControls } from "@/components/publisher/stream-controls"
import { StreamHistory } from "@/components/publisher/stream-history"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signOut } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Podcast as Broadcast, History, LogOut, Monitor } from "lucide-react"
import type { StreamSession } from "@/lib/streaming"
import { PublisherZoomCalls } from "@/components/publisher/zoom-calls"

export default function PublisherDashboard() {
  const { userProfile } = useAuth()
  const router = useRouter()
  const [currentStream, setCurrentStream] = useState<StreamSession | null>(null)

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const handleStreamStart = (session: StreamSession) => {
    setCurrentStream(session)
  }

  const handleStreamEnd = () => {
    setCurrentStream(null)
  }

  return (
    <ProtectedRoute allowedRoles={["publisher"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Broadcast className="h-6 w-6" />
                <div>
                  <h1 className="text-2xl font-bold">Publisher Dashboard</h1>
                  <p className="text-muted-foreground">
                    Welcome back, {userProfile?.displayName || userProfile?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {currentStream && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      LIVE: {currentStream.title}
                    </span>
                  </div>
                )}
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="stream" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stream" className="flex items-center space-x-2">
                <Monitor className="h-4 w-4" />
                <span>Stream Control</span>
              </TabsTrigger>
              <TabsTrigger value="zoom" className="flex items-center space-x-2">
                <span>Zoom Calls</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History className="h-4 w-4" />
                <span>Stream History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stream" forceMount>
              <StreamControls onStreamStart={handleStreamStart} onStreamEnd={handleStreamEnd} />
            </TabsContent>

            <TabsContent value="zoom">
              <PublisherZoomCalls />
            </TabsContent>

            <TabsContent value="history">
              <StreamHistory />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  )
}
