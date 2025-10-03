"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { 
  getPublisherAnalytics,
  getActiveViewers,
  subscribeToActiveViewers,
  getStreamViewerHistory,
  type PublisherAnalytics,
  type ViewerSession 
} from "@/lib/analytics"
import { getPublisherStreams } from "@/lib/streaming"
import type { StreamSession } from "@/lib/streaming"
import { useAuth } from "@/hooks/use-auth"
import { 
  Users, 
  Eye, 
  Clock, 
  BarChart3,
  RefreshCw,
  Monitor,
  TrendingUp,
  History,
  User
} from "lucide-react"

export function PublisherAnalytics() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<PublisherAnalytics | null>(null)
  const [currentStreamViewers, setCurrentStreamViewers] = useState<ViewerSession[]>([])
  const [streamHistory, setStreamHistory] = useState<StreamSession[]>([])
  const [selectedStream, setSelectedStream] = useState<StreamSession | null>(null)
  const [streamViewerHistory, setStreamViewerHistory] = useState<ViewerSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return
    
    loadAnalytics()
    
    // Set up real-time subscription to active viewers for current stream
    let unsubscribe: (() => void) | null = null
    
    if (selectedStream) {
      unsubscribe = subscribeToActiveViewers(selectedStream.id!, (viewers) => {
        setCurrentStreamViewers(viewers)
      })
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user, selectedStream])

  const loadAnalytics = async () => {
    if (!user) return
    
    try {
      setRefreshing(true)
      const [analyticsData, streamsData] = await Promise.all([
        getPublisherAnalytics(user.uid),
        getPublisherStreams(user.uid)
      ])
      
      setAnalytics(analyticsData)
      setStreamHistory(streamsData)
      
      // Set current active stream if any
      const activeStream = streamsData.find(stream => stream.isActive)
      if (activeStream) {
        setSelectedStream(activeStream)
        const viewers = await getActiveViewers(activeStream.id!)
        setCurrentStreamViewers(viewers)
      }
      
      setError("")
    } catch (err: any) {
      console.error("Error loading analytics:", err)
      setError("Failed to load analytics data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleStreamSelect = async (stream: StreamSession) => {
    setSelectedStream(stream)
    if (stream.isActive) {
      const viewers = await getActiveViewers(stream.id!)
      setCurrentStreamViewers(viewers)
    } else {
      const history = await getStreamViewerHistory(stream.id!)
      setStreamViewerHistory(history)
    }
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString() + " " + new Date(date).toLocaleTimeString()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load analytics data</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <CardTitle>Your Stream Analytics</CardTitle>
              <Badge variant="outline" className="animate-pulse">
                Real-time
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalytics}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Track your stream performance and viewer engagement
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Streams</p>
                <p className="text-2xl font-bold">{analytics.totalStreams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Total Viewers</p>
                <p className="text-2xl font-bold">{analytics.totalViewers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Avg Viewers/Stream</p>
                <p className="text-2xl font-bold">{analytics.averageViewersPerStream.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Total Duration</p>
                <p className="text-2xl font-bold">{formatDuration(analytics.totalDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stream Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Stream to View Analytics</CardTitle>
          <CardDescription>Choose a stream to see detailed viewer information</CardDescription>
        </CardHeader>
        <CardContent>
          {streamHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No streams found</p>
              <p className="text-sm">Start streaming to see analytics</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {streamHistory.map((stream) => (
                <Card 
                  key={stream.id}
                  className={`cursor-pointer transition-colors hover:bg-muted ${
                    selectedStream?.id === stream.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleStreamSelect(stream)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium truncate">
                        {stream.title || "Untitled Stream"}
                      </h3>
                      <Badge variant={stream.isActive ? "destructive" : "secondary"}>
                        {stream.isActive ? "LIVE" : "Ended"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(stream.createdAt)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Monitor className="h-3 w-3" />
                        <span>Room: {stream.roomId}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Stream Viewers */}
      {selectedStream && selectedStream.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-green-500" />
              <span>Live Viewers - {selectedStream.title || "Untitled Stream"}</span>
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
            </CardTitle>
            <CardDescription>
              Real-time viewer count: {currentStreamViewers.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStreamViewers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No viewers currently watching</p>
                <p className="text-sm">Viewers will appear here when they join your stream</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Viewer Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Watching Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentStreamViewers.map((viewer) => {
                    const duration = Math.floor((new Date().getTime() - new Date(viewer.joinedAt).getTime()) / 1000)
                    
                    return (
                      <TableRow key={viewer.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{viewer.subscriberName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{viewer.subscriberEmail}</TableCell>
                        <TableCell>
                          {new Date(viewer.joinedAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{formatDuration(duration)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Stream Viewers */}
      {selectedStream && !selectedStream.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5 text-blue-500" />
              <span>Viewer History - {selectedStream.title || "Untitled Stream"}</span>
            </CardTitle>
            <CardDescription>
              Complete list of viewers who watched this stream
            </CardDescription>
          </CardHeader>
          <CardContent>
            {streamViewerHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No viewers for this stream</p>
                <p className="text-sm">This stream had no viewers</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Viewer Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streamViewerHistory.map((viewer) => (
                    <TableRow key={viewer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{viewer.subscriberName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{viewer.subscriberEmail}</TableCell>
                      <TableCell>
                        {new Date(viewer.joinedAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        {viewer.leftAt ? new Date(viewer.leftAt).toLocaleTimeString() : "Still watching"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDuration(viewer.duration || 0)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
