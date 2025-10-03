"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  getAdminAnalytics, 
  getAllActiveViewers, 
  subscribeToAllActiveViewers,
  type AdminAnalytics,
  type ViewerSession 
} from "@/lib/analytics"
import { getActiveStreams } from "@/lib/streaming"
import type { StreamSession } from "@/lib/streaming"
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Eye, 
  Clock, 
  BarChart3,
  RefreshCw,
  Monitor,
  User
} from "lucide-react"

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [activeViewers, setActiveViewers] = useState<ViewerSession[]>([])
  const [activeStreams, setActiveStreams] = useState<StreamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    loadAnalytics()
    
    // Set up real-time subscription to active viewers
    const unsubscribe = subscribeToAllActiveViewers((viewers) => {
      setActiveViewers(viewers)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const loadAnalytics = async () => {
    try {
      setRefreshing(true)
      const [analyticsData, streamsData] = await Promise.all([
        getAdminAnalytics(),
        getActiveStreams()
      ])
      
      setAnalytics(analyticsData)
      setActiveStreams(streamsData)
      setError("")
    } catch (err: any) {
      console.error("Error loading analytics:", err)
      setError("Failed to load analytics data")
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  const getStreamViewerCount = (streamId: string): number => {
    return activeViewers.filter(viewer => viewer.streamId === streamId).length
  }

  const getStreamViewers = (streamId: string): ViewerSession[] => {
    return activeViewers.filter(viewer => viewer.streamId === streamId)
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
              <CardTitle>Live Analytics Dashboard</CardTitle>
              <Badge variant="outline" className="animate-pulse">
                Real-time
              </Badge>
            </div>
            <button
              onClick={loadAnalytics}
              disabled={refreshing}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <CardDescription>
            Real-time monitoring of subscribers, streams, and viewer activity
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
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Subscribers</p>
                <p className="text-2xl font-bold">{analytics.totalSubscribers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Active Streams</p>
                <p className="text-2xl font-bold">{analytics.activeStreams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Active Viewers</p>
                <p className="text-2xl font-bold">{analytics.totalActiveViewers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Avg Viewers/Stream</p>
                <p className="text-2xl font-bold">{analytics.averageViewersPerStream.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Streams Today</p>
                <p className="text-2xl font-bold">{analytics.totalStreamsToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-sm font-medium">Total Publishers</p>
                <p className="text-2xl font-bold">{analytics.totalPublishers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-pink-600" />
              <div>
                <p className="text-sm font-medium">Peak Viewers Today</p>
                <p className="text-2xl font-bold">{analytics.peakViewersToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Streams with Viewer Counts */}
      <Card>
        <CardHeader>
          <CardTitle>Live Streams & Viewers</CardTitle>
          <CardDescription>Real-time viewer counts for each active stream</CardDescription>
        </CardHeader>
        <CardContent>
          {activeStreams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active streams</p>
              <p className="text-sm">Streams will appear here when publishers go live</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stream Title</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Room ID</TableHead>
                  <TableHead>Viewers</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStreams.map((stream) => {
                  const viewerCount = getStreamViewerCount(stream.id!)
                  const duration = Math.floor((new Date().getTime() - new Date(stream.createdAt).getTime()) / 1000)
                  
                  return (
                    <TableRow key={stream.id}>
                      <TableCell className="font-medium">
                        {stream.title || "Untitled Stream"}
                      </TableCell>
                      <TableCell>{stream.publisherName}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {stream.roomId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{viewerCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDuration(duration)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="animate-pulse">
                          LIVE
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active Viewers Details */}
      <Card>
        <CardHeader>
          <CardTitle>Active Viewers</CardTitle>
          <CardDescription>Currently watching streams across all publishers</CardDescription>
        </CardHeader>
        <CardContent>
          {activeViewers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active viewers</p>
              <p className="text-sm">Viewers will appear here when they join streams</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscriber</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Watching</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeViewers.map((viewer) => {
                  const duration = Math.floor((new Date().getTime() - new Date(viewer.joinedAt).getTime()) / 1000)
                  
                  return (
                    <TableRow key={viewer.id}>
                      <TableCell className="font-medium">
                        {viewer.subscriberName}
                      </TableCell>
                      <TableCell>{viewer.subscriberEmail}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span>{viewer.streamTitle || "Untitled Stream"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{viewer.publisherName}</TableCell>
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
    </div>
  )
}
