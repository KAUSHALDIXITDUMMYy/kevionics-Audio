"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Play, Square, Mic, MicOff, Volume2, VolumeX, Users, Clock } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { agoraManager } from "@/lib/agora"
import { createStreamSession, endStreamSession, generateRoomId, type StreamSession } from "@/lib/streaming"

interface StreamControlsProps {
  onStreamStart?: (session: StreamSession) => void
  onStreamEnd?: () => void
}

export function StreamControls({ onStreamStart, onStreamEnd }: StreamControlsProps) {
  const { user, userProfile } = useAuth()
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAudioSharing, setIsAudioSharing] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [currentSession, setCurrentSession] = useState<StreamSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Stream setup form
  const [streamTitle, setStreamTitle] = useState("")
  const [streamDescription, setStreamDescription] = useState("")
  const [gameName, setGameName] = useState("")
  const [league, setLeague] = useState("")
  const [match, setMatch] = useState("")

  const [jitsiContainer, setJitsiContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      agoraManager.leave()
    }
  }, [])

  const handleStartStream = async () => {
    if (!user || !userProfile) return

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const roomId = generateRoomId(user.uid)

      // Create stream session in database
      const sessionResult = await createStreamSession({
        publisherId: user.uid,
        publisherName: userProfile.displayName || userProfile.email,
        roomId,
        isActive: true,
        title: streamTitle || "Untitled Stream",
        description: streamDescription,
        gameName: gameName || undefined,
        league: league || undefined,
        match: match || undefined,
      })

      if (!sessionResult.success) {
        throw new Error(sessionResult.error)
      }

      // Initialize Agora as publisher and auto-start screen share
      if (jitsiContainer) {
        await agoraManager.join({
          channelName: roomId,
          role: "publisher",
          container: jitsiContainer,
          width: "100%",
          height: 500,
        })

        setIsStreaming(true)
        setIsAudioSharing(true) // Auto-start audio sharing
        setSuccess("Audio stream started successfully!")
        setCurrentSession(sessionResult.session!)
        onStreamStart?.(sessionResult.session!)
      }
    } catch (err: any) {
      setError(err.message || "Failed to start stream")
    }

    setLoading(false)
  }

  const handleEndStream = async () => {
    if (!currentSession) return

    setLoading(true)

    try {
      await endStreamSession(currentSession.id!)
      await agoraManager.leave()
      setIsStreaming(false)
      setIsAudioSharing(false)
      setIsAudioMuted(false)
      setIsVideoMuted(false)
      setCurrentSession(null)
      setStreamTitle("")
      setStreamDescription("")
      setGameName("")
      setLeague("")
      setMatch("")
      setSuccess("Stream ended successfully!")
      onStreamEnd?.()
    } catch (err: any) {
      setError(err.message || "Failed to end stream")
    }

    setLoading(false)
  }

  const handleToggleAudioShare = async () => {
    try {
      if (!isAudioSharing) {
        if (jitsiContainer) await agoraManager.startScreenShare(jitsiContainer)
        setIsAudioSharing(true)
      } else {
        await agoraManager.stopScreenShare()
        setIsAudioSharing(false)
      }
    } catch (err: any) {
      setError("Failed to toggle audio share")
    }
  }

  const handleToggleAudio = async () => {
    try {
      if (isAudioMuted) {
        await agoraManager.enableMic()
        setIsAudioMuted(false)
      } else {
        await agoraManager.disableMic()
        setIsAudioMuted(true)
      }
    } catch (err: any) {
      setError("Failed to toggle audio")
    }
  }

  // Remove video toggle for audio-only mode

  return (
    <div className="space-y-6">
      {/* Stream Setup */}
      {!isStreaming && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Stream</CardTitle>
            <CardDescription>Configure your stream settings and start broadcasting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Stream Title</Label>
              <Input
                id="title"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter stream title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="Describe your stream"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gameName">Game Name</Label>
                <Input
                  id="gameName"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="e.g., League of Legends"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="league">League</Label>
                <Input
                  id="league"
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  placeholder="e.g., LCS, LEC, Worlds"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="match">Match</Label>
                <Input
                  id="match"
                  value={match}
                  onChange={(e) => setMatch(e.target.value)}
                  placeholder="e.g., Team A vs Team B"
                />
              </div>
            </div>

            <Button onClick={handleStartStream} disabled={loading} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {loading ? "Starting Stream..." : "Start Stream"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Stream Controls */}
      {isStreaming && currentSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Badge variant="destructive" className="animate-pulse">
                    LIVE
                  </Badge>
                  <span>{currentSession.title}</span>
                </CardTitle>
                <CardDescription className="flex items-center space-x-4 mt-2">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Started: {new Date(currentSession.createdAt).toLocaleTimeString()}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>Room: {currentSession.roomId}</span>
                  </span>
                </CardDescription>
                {(currentSession.gameName || currentSession.league || currentSession.match) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentSession.gameName && <Badge variant="outline">Game: {currentSession.gameName}</Badge>}
                    {currentSession.league && <Badge variant="outline">League: {currentSession.league}</Badge>}
                    {currentSession.match && <Badge variant="outline">Match: {currentSession.match}</Badge>}
                  </div>
                )}
              </div>
              <Button variant="destructive" onClick={handleEndStream} disabled={loading}>
                <Square className="h-4 w-4 mr-2" />
                {loading ? "Ending..." : "End Stream"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Audio-only mode indicators */}
            <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg mb-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">Audio Mode: System audio sharing</span>
              </div>
              <div className="flex items-center space-x-2">
                <VolumeX className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Video: Disabled (Audio-only)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={isAudioSharing ? "default" : "outline"} onClick={handleToggleAudioShare} size="sm">
                {isAudioSharing ? (
                  <>
                    <VolumeX className="h-4 w-4 mr-2" />
                    Stop Audio Share
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Start Audio Share
                  </>
                )}
              </Button>

              <Button variant={isAudioMuted ? "destructive" : "default"} onClick={handleToggleAudio} size="sm">
                {isAudioMuted ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Unmute Mic
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Mute Mic
                  </>
                )}
              </Button>

              <Badge variant="outline" className="flex items-center space-x-1">
                <Volume2 className="h-3 w-3" />
                <span>Audio-Only Mode</span>
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stream Container */}
      <Card>
        <CardHeader>
          <CardTitle>Stream View</CardTitle>
          <CardDescription>
            {isStreaming
              ? "Your audio-only stream is active. Share system audio without showing your screen."
              : "Start a stream to begin sharing audio in audio-only mode."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={setJitsiContainer}
            className="w-full h-[500px] bg-muted rounded-lg flex items-center justify-center"
          >
            {!isStreaming && (
              <div className="text-center text-muted-foreground">
                <Volume2 className="h-12 w-12 mx-auto mb-4" />
                <p>Audio-only stream interface will appear here</p>
                <p className="text-sm mt-2">No video will be shared, only system audio</p>
              </div>
            )}
            {isStreaming && isAudioSharing && (
              <div className="text-center text-muted-foreground">
                <div className="mb-4">
                  <Volume2 className="h-16 w-16 mx-auto text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Audio-Only Mode</h3>
                <p className="text-sm text-muted-foreground mb-4">Sharing system audio</p>
                <div className="flex space-x-1 justify-center">
                  <div className="w-1 h-8 bg-green-500 rounded animate-pulse"></div>
                  <div className="w-1 h-6 bg-green-500 rounded animate-pulse" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1 h-10 bg-green-500 rounded animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-1 h-4 bg-green-500 rounded animate-pulse" style={{animationDelay: '0.3s'}}></div>
                  <div className="w-1 h-8 bg-green-500 rounded animate-pulse" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
