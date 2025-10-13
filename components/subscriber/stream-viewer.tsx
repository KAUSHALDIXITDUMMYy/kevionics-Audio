"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { agoraManager } from "@/lib/agora"
import type { SubscriberPermission } from "@/lib/subscriber"
import { Play, Square, Volume2, VolumeX, Video, Users, Clock, Monitor } from "lucide-react"

interface StreamViewerProps {
  permission: SubscriberPermission
  onJoinStream?: (permission: SubscriberPermission) => void
  onLeaveStream?: () => void
}

export function StreamViewer({ permission, onJoinStream, onLeaveStream }: StreamViewerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const jitsiContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isConnected) {
        agoraManager.leave()
      }
    }
  }, [isConnected])

  const handleJoinStream = async () => {
    if (!permission.streamSession || !jitsiContainerRef.current) return

    setLoading(true)
    setError("")

    try {
      await agoraManager.join({
        channelName: permission.streamSession.roomId,
        role: "audience",
        container: jitsiContainerRef.current,
        width: "100%",
        height: 500,
      })

      setIsConnected(true)
      setLoading(false)
      onJoinStream?.(permission)

      setAudioEnabled(true) // Start with audio enabled for audio-only mode
      setVideoEnabled(false)
    } catch (err: any) {
      setError(err.message || "Failed to join stream")
      setLoading(false)
    }
  }

  const handleLeaveStream = () => {
    agoraManager.leave()
    setIsConnected(false)
    setLoading(false)
    onLeaveStream?.()
  }

  const handleToggleAudio = async () => {
    if (!permission.allowAudio) return

    try {
      // Toggle audio playback for the subscriber
      setAudioEnabled(!audioEnabled)
      // Note: In audio-only mode, this controls whether the subscriber hears the shared screen audio
    } catch (err: any) {
      setError("Failed to toggle audio")
    }
  }

  if (!permission.streamSession) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active stream</p>
            <p className="text-sm">This publisher is not currently streaming</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
              <span>{permission.streamSession.title}</span>
            </CardTitle>
            <CardDescription className="flex items-center space-x-4 mt-2">
              <span className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Publisher: {permission.publisherName}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>Started: {new Date(permission.streamSession.createdAt).toLocaleTimeString()}</span>
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {!isConnected ? (
              <Button onClick={handleJoinStream} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                {loading ? "Joining..." : "Join Stream"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleLeaveStream}>
                <Square className="h-4 w-4 mr-2" />
                Leave Stream
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Audio-only mode indicators */}
        <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <Video className="h-4 w-4 text-orange-600" />
            <span className="text-sm">Video: Audio-only mode</span>
          </div>
          <div className="flex items-center space-x-2">
            <Volume2 className={`h-4 w-4 ${permission.allowAudio ? "text-green-600" : "text-gray-400"}`} />
            <span className="text-sm">Audio: {permission.allowAudio ? "Allowed" : "Restricted"}</span>
          </div>
        </div>

        {/* Stream controls for connected users */}
        {isConnected && (
          <div className="flex items-center space-x-2">
            {permission.allowAudio && (
              <Button variant={audioEnabled ? "default" : "destructive"} onClick={handleToggleAudio} size="sm">
                {audioEnabled ? (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Audio On
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4 mr-2" />
                    Audio Off
                  </>
                )}
              </Button>
            )}
            <Badge variant="outline" className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Connected</span>
            </Badge>
          </div>
        )}

        {/* Stream description */}
        {permission.streamSession.description && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{permission.streamSession.description}</p>
          </div>
        )}

        {/* Audio-only Stream Container */}
        <div ref={jitsiContainerRef} className="w-full h-[200px] bg-muted rounded-lg flex items-center justify-center">
          {!isConnected && (
            <div className="text-center text-muted-foreground">
              <Volume2 className="h-12 w-12 mx-auto mb-4" />
              <p>Click "Join Stream" to start listening</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs">Audio-only mode:</p>
                <div className="flex items-center justify-center space-x-4 text-xs">
                  <span className="text-orange-600">
                    Video: ✗ (Audio-only)
                  </span>
                  <span className={permission.allowAudio ? "text-green-600" : "text-red-600"}>
                    Audio: {permission.allowAudio ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            </div>
          )}
          {isConnected && (
            <div className="text-center text-muted-foreground">
              <Volume2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <p>Listening to shared screen audio</p>
              <p className="text-sm mt-2">Audio-only mode active</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
