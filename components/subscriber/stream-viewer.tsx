"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { agoraManager } from "@/lib/agora"
import type { SubscriberPermission } from "@/lib/subscriber"
import { Volume2, VolumeX, Video, Users, Clock, Monitor, Loader2 } from "lucide-react"

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
  const [hasVideoTrack, setHasVideoTrack] = useState(false)
  const jitsiContainerRef = useRef<HTMLDivElement>(null)
  const currentRoomRef = useRef<string | null>(null)

  // Auto-join stream when permission changes
  useEffect(() => {
    if (!permission.streamSession || !jitsiContainerRef.current) return

    const newRoomId = permission.streamSession.roomId

    // If we're already in the same room, don't rejoin
    if (currentRoomRef.current === newRoomId && isConnected) {
      return
    }

    // Auto-join the new stream (join() handles leaving previous stream automatically)
    const joinStream = async () => {
      setLoading(true)
      setError("")

      try {
        console.log("[StreamViewer] Joining stream:", newRoomId)
        
        // Join new stream - this will automatically leave the previous one
        await agoraManager.join({
          channelName: newRoomId,
          role: "audience",
          container: jitsiContainerRef.current!,
          width: "100%",
          height: 500,
        })

        currentRoomRef.current = newRoomId
        setIsConnected(true)
        setAudioEnabled(true)
        setVideoEnabled(false)
        setHasVideoTrack(false) // Will be updated when tracks are published
        onJoinStream?.(permission)
        
        console.log("[StreamViewer] Successfully connected to:", newRoomId)
        
        // Set up listeners for when tracks are published (they may publish after joining)
        // Note: The agora manager already handles this, but we track state here for UI
        setTimeout(() => {
          // Check if video track exists after a short delay
          // This is handled by the agora manager's event listeners
        }, 1000)
      } catch (err: any) {
        console.error("[StreamViewer] Failed to join stream:", err)
        setError(err.message || "Failed to join stream")
        currentRoomRef.current = null
        setIsConnected(false)
      } finally {
        setLoading(false)
      }
    }

    joinStream()

    return () => {
      // Cleanup on unmount - only leave if we're actually connected
      console.log("[StreamViewer] Component unmounting, cleaning up...")
      if (currentRoomRef.current) {
        agoraManager.leave()
        currentRoomRef.current = null
        setIsConnected(false)
      }
    }
  }, [permission.streamSession?.roomId])

  const handleToggleAudio = async () => {
    if (!permission.allowAudio) return

    try {
      // Toggle audio playback for the subscriber
      const newAudioState = !audioEnabled
      setAudioEnabled(newAudioState)
      
      // Note: The agora manager handles audio playback automatically through event listeners
      // This toggle is primarily for UI state tracking
      // If we need explicit control, we can add methods to agoraManager later
    } catch (err: any) {
      setError("Failed to toggle audio")
    }
  }
  
  // Check for video tracks periodically
  useEffect(() => {
    if (isConnected) {
      const checkVideoTracks = () => {
        const hasVideo = agoraManager.hasVideoTrack()
        setHasVideoTrack(hasVideo)
      }
      
      const interval = setInterval(checkVideoTracks, 1000)
      checkVideoTracks() // Initial check
      
      return () => clearInterval(interval)
    } else {
      setHasVideoTrack(false)
    }
  }, [isConnected])

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
            {loading ? (
              <Badge variant="outline" className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Connecting...</span>
              </Badge>
            ) : isConnected ? (
              <Badge variant="outline" className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Connected</span>
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Streaming mode indicators */}
        <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            {hasVideoTrack ? (
              <>
                <Video className="h-4 w-4 text-green-600" />
                <span className="text-sm">Video: Enabled</span>
              </>
            ) : (
              <>
                <Video className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Video: Audio-only mode</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Volume2 className={`h-4 w-4 ${permission.allowAudio ? "text-green-600" : "text-gray-400"}`} />
            <span className="text-sm">Audio: {permission.allowAudio ? "Allowed" : "Restricted"}</span>
          </div>
        </div>

        {/* Stream controls for connected users */}
        {isConnected && permission.allowAudio && (
          <div className="flex items-center space-x-2">
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
          </div>
        )}

        {/* Stream description */}
        {permission.streamSession.description && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{permission.streamSession.description}</p>
          </div>
        )}

        {/* Stream Container */}
        <div ref={jitsiContainerRef} className={`w-full ${hasVideoTrack ? 'h-[500px]' : 'h-[200px]'} bg-muted rounded-lg flex items-center justify-center overflow-hidden`}>
          {loading && (
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="font-medium">Connecting to stream...</p>
              <p className="text-sm mt-2">Please wait</p>
            </div>
          )}
          {!loading && !isConnected && (
            <div className="text-center text-muted-foreground">
              {hasVideoTrack ? (
                <Video className="h-12 w-12 mx-auto mb-4" />
              ) : (
                <Volume2 className="h-12 w-12 mx-auto mb-4" />
              )}
              <p>Auto-connecting to stream...</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs">Waiting for stream...</p>
                <div className="flex items-center justify-center space-x-4 text-xs">
                  <span className={hasVideoTrack ? "text-green-600" : "text-orange-600"}>
                    Video: {hasVideoTrack ? "✓" : "✗"}
                  </span>
                  <span className={permission.allowAudio ? "text-green-600" : "text-red-600"}>
                    Audio: {permission.allowAudio ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            </div>
          )}
          {!loading && isConnected && !hasVideoTrack && (
            <div className="text-center text-muted-foreground">
              <Volume2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <p className="font-medium text-green-600">Listening to shared screen audio</p>
              <p className="text-sm mt-2">Audio-only mode active</p>
            </div>
          )}
          {!loading && isConnected && hasVideoTrack && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <p className="font-medium text-green-600">Video stream active</p>
                <p className="text-sm mt-2">Video will appear here when publisher shares screen</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
