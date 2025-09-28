"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { getAvailableStreams } from "@/lib/subscriber"
import type { SubscriberPermission } from "@/lib/subscriber"
import { StreamViewer } from "./stream-viewer"
import { Monitor, Activity, Gamepad2, Trophy, Users } from "lucide-react"

export function RealTimeStreams() {
  const { user } = useAuth()
  const [availableStreams, setAvailableStreams] = useState<SubscriberPermission[]>([])
  const [selectedStream, setSelectedStream] = useState<SubscriberPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return

    const loadStreams = async () => {
      try {
        console.log("[v0] Loading streams for user:", user.uid)
        const streams = await getAvailableStreams(user.uid)
        console.log("[v0] Available streams loaded:", streams.length)
        setAvailableStreams(streams)
        // Keep selected stream in sync with latest data or clear if gone
        setSelectedStream((current) => {
          if (!current) return current
          const updated = streams.find((s) => s.id === current.id) || null
          return updated
        })
        setError("")
      } catch (err: any) {
        console.error("[v0] Error loading streams:", err)
        setError("Failed to load streams")
      } finally {
        setLoading(false)
      }
    }

    loadStreams()

    // Set up polling for real-time updates
    const interval = setInterval(loadStreams, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [user])

  const handleSelectStream = (stream: SubscriberPermission) => {
    console.log("[v0] Selecting stream:", stream.id)
    // Toggle selection: clicking the same stream collapses the viewer
    if (selectedStream?.id === stream.id) {
      setSelectedStream(null)
    } else {
      setSelectedStream(stream)
    }
  }

  const handleBackToList = () => {
    setSelectedStream(null)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading streams...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Split view: left list, right viewer
  const rightPane = (
    <div className="p-0">
      {selectedStream ? (
        <StreamViewer
          key={selectedStream.streamSession?.roomId || selectedStream.id}
          permission={selectedStream}
          onLeaveStream={() => setSelectedStream(null)}
        />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center p-12 text-muted-foreground">
            Select a stream to start watching
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Real-time Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-500" />
              <CardTitle>Live Streams</CardTitle>
              <Badge variant="outline" className="animate-pulse">
                Auto-updating
              </Badge>
            </div>
          </div>
          <CardDescription>Your stream access is managed by administrators</CardDescription>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Available Streams + Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {availableStreams.length === 0 ? (
          <Card className="lg:col-span-3">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center text-muted-foreground">
                <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Active Streams</h3>
                <p>There are currently no live streams available to you.</p>
                <p className="text-sm mt-2">
                  Contact your administrator to get stream access or wait for publishers to start streaming.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="lg:col-span-1 space-y-4">
              {availableStreams.map((stream) => (
                <Card
                  key={stream.id}
                  className={`transition-shadow cursor-pointer ${
                    selectedStream?.id === stream.id ? "ring-2 ring-primary" : "hover:shadow-lg"
                  }`}
                  onClick={() => handleSelectStream(stream)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="flex items-center space-x-2">
                          <Badge variant="destructive" className="animate-pulse">
                            LIVE
                          </Badge>
                          <span>{stream.streamSession?.title || "Untitled Stream"}</span>
                        </CardTitle>
                        <CardDescription>Publisher: {stream.publisherName}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-2">{rightPane}</div>
          </>
        )}
      </div>
    </div>
  )
}
