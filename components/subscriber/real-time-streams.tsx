"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { subscribeToAvailableStreams, userCache } from "@/lib/subscriber"
import type { SubscriberPermission } from "@/lib/subscriber"
import { StreamViewer } from "./stream-viewer"
import { Monitor, Activity, Gamepad2, Trophy, Users } from "lucide-react"

export function RealTimeStreams() {
  const { user, userProfile } = useAuth()
  const [availableStreams, setAvailableStreams] = useState<SubscriberPermission[]>([])
  const [selectedStream, setSelectedStream] = useState<SubscriberPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!user) return

    console.log("[v0] Setting up real-time subscription for user:", user.uid)
    
    // Start user cache real-time sync (prevents stale user data, uses single listener)
    userCache.startRealtimeSync()

    // Subscribe to real-time updates (NO MORE POLLING!)
    const unsubscribe = subscribeToAvailableStreams(user.uid, {
      onStreamsUpdate: (streams) => {
        console.log("[v0] Real-time streams update:", streams.length)
        setAvailableStreams(streams)
        
        // Keep selected stream in sync with latest data or clear if gone
        setSelectedStream((current) => {
          if (!current) return current
          const updated = streams.find((s) => s.id === current.id) || null
          return updated
        })
        
        if (isFirstLoad.current) {
          setLoading(false)
          isFirstLoad.current = false
        }
        setError("")
      },
      onError: (err) => {
        console.error("[v0] Real-time subscription error:", err)
        setError("Failed to load streams")
        setLoading(false)
      }
    })

    // Cleanup on unmount
    return () => {
      console.log("[v0] Cleaning up real-time subscription")
      unsubscribe()
      userCache.stopRealtimeSync()
    }
  }, [user])

  const handleSelectStream = (stream: SubscriberPermission) => {
    console.log("[v0] Selecting stream:", stream.id)
    // Simply switch to the new stream - no toggle behavior
    // The StreamViewer will auto-leave the previous stream and auto-join the new one
    setSelectedStream(stream)
  }

  const handleBackToList = () => {
    setSelectedStream(null)
  }

  // Check if user is inactive
  if (userProfile && !userProfile.isActive) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 rounded-full inline-block">
              <Monitor className="h-16 w-16 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Account Inactive</h3>
            <p className="text-muted-foreground mb-4">
              Your account has been deactivated by an administrator.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to reactivate your account and regain access to streams.
            </p>
          </div>
        </CardContent>
      </Card>
    )
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
          <CardDescription>Click any stream to instantly connect. Switch streams seamlessly with a single click.</CardDescription>
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
                  className={`transition-all cursor-pointer ${
                    selectedStream?.id === stream.id 
                      ? "ring-2 ring-primary shadow-lg bg-primary/5" 
                      : "hover:shadow-lg hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectStream(stream)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <CardTitle className="flex items-center space-x-2">
                          <Badge variant="destructive" className="animate-pulse">
                            LIVE
                          </Badge>
                          <span className="text-sm">{stream.streamSession?.title || "Untitled Stream"}</span>
                        </CardTitle>
                        <CardDescription className="text-xs">Publisher: {stream.publisherName}</CardDescription>
                      </div>
                      {selectedStream?.id === stream.id && (
                        <Badge variant="default" className="ml-2">
                          Active
                        </Badge>
                      )}
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
