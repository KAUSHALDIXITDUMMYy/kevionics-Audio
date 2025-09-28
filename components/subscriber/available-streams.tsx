"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { getAvailableStreams, type SubscriberPermission } from "@/lib/subscriber"
import { StreamViewer } from "./stream-viewer"
import { Monitor, Users, Video, Volume2, Clock, RefreshCw } from "lucide-react"

export function AvailableStreams() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<SubscriberPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStream, setSelectedStream] = useState<SubscriberPermission | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user) {
      loadStreams()
      // Set up periodic refresh for live streams
      const interval = setInterval(loadStreams, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user])

  const loadStreams = async () => {
    if (!user) return

    const isInitialLoad = loading
    if (!isInitialLoad) setRefreshing(true)

    try {
      const availableStreams = await getAvailableStreams(user.uid)
      setPermissions(availableStreams)

      // If currently selected stream is no longer available, clear selection
      if (selectedStream && !availableStreams.find((p) => p.id === selectedStream.id)) {
        setSelectedStream(null)
      }
    } catch (error) {
      console.error("Error loading streams:", error)
    }

    setLoading(false)
    setRefreshing(false)
  }

  const handleSelectStream = (permission: SubscriberPermission) => {
    setSelectedStream(permission)
  }

  const handleBackToList = () => {
    setSelectedStream(null)
  }

  const handleJoinStream = (permission: SubscriberPermission) => {
    console.log("Joined stream:", permission.streamSession?.title)
  }

  const handleLeaveStream = () => {
    // Stream left
    console.log("Left stream")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading available streams...</p>
        </div>
      </div>
    )
  }

  // Show selected stream viewer
  if (selectedStream) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBackToList}>
            ← Back to Streams
          </Button>
          <Button variant="outline" onClick={loadStreams} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <StreamViewer permission={selectedStream} onJoinStream={handleJoinStream} onLeaveStream={handleLeaveStream} />
      </div>
    )
  }

  // Show streams list
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Available Streams</h2>
          <p className="text-muted-foreground">
            {permissions.length} stream{permissions.length !== 1 ? "s" : ""} available to you
          </p>
        </div>
        <Button variant="outline" onClick={loadStreams} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Streams Grid */}
      {permissions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center text-muted-foreground">
              <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Active Streams</h3>
              <p>There are currently no live streams available to you.</p>
              <p className="text-sm mt-2">Check back later or contact your administrator for access.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {permissions.map((permission) => (
            <Card key={permission.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center space-x-2">
                      <Badge variant="destructive" className="animate-pulse">
                        LIVE
                      </Badge>
                      <span>{permission.streamSession?.title}</span>
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>Publisher: {permission.publisherName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Started: {new Date(permission.streamSession!.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stream Description */}
                {permission.streamSession?.description && (
                  <p className="text-sm text-muted-foreground">{permission.streamSession.description}</p>
                )}

                {/* Permissions */}
                <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Video className={`h-4 w-4 ${permission.allowVideo ? "text-green-600" : "text-gray-400"}`} />
                    <span className="text-sm">Video</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Volume2 className={`h-4 w-4 ${permission.allowAudio ? "text-green-600" : "text-gray-400"}`} />
                    <span className="text-sm">Audio</span>
                  </div>
                </div>

                {/* Action Button */}
                <Button onClick={() => handleSelectStream(permission)} className="w-full">
                  <Monitor className="h-4 w-4 mr-2" />
                  Watch Stream
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
