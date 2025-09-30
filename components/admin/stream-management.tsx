"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  getAllStreams, 
  getActiveStreams, 
  endStreamSessionById, 
  deleteStreamSession, 
  endAllActiveStreams,
  type StreamSession 
} from "@/lib/streaming"
import { getUsersByRole, type UserProfile } from "@/lib/admin"
import { 
  Video, 
  Square, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Users, 
  RefreshCw,
  Power
} from "lucide-react"

export function StreamManagement() {
  const [allStreams, setAllStreams] = useState<StreamSession[]>([])
  const [activeStreams, setActiveStreams] = useState<StreamSession[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [streamsData, activeData, publishersData] = await Promise.all([
        getAllStreams(),
        getActiveStreams(),
        getUsersByRole("publisher"),
      ])

      setAllStreams(streamsData)
      setActiveStreams(activeData)
      setPublishers(publishersData as (UserProfile & { id: string })[])
      setError("")
    } catch (err: any) {
      setError("Failed to load stream data")
      console.error("Error loading data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEndStream = async (streamId: string) => {
    setActionLoading(streamId)
    setError("")
    setSuccess("")

    try {
      const result = await endStreamSessionById(streamId)
      if (result.success) {
        setSuccess("Stream ended successfully")
        await loadData()
      } else {
        setError(result.error || "Failed to end stream")
      }
    } catch (err: any) {
      setError("Failed to end stream")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteStream = async (streamId: string) => {
    if (!confirm("Are you sure you want to permanently delete this stream? This action cannot be undone.")) {
      return
    }

    setActionLoading(streamId)
    setError("")
    setSuccess("")

    try {
      const result = await deleteStreamSession(streamId)
      if (result.success) {
        setSuccess("Stream deleted successfully")
        await loadData()
      } else {
        setError(result.error || "Failed to delete stream")
      }
    } catch (err: any) {
      setError("Failed to delete stream")
    } finally {
      setActionLoading(null)
    }
  }

  const handleEndAllStreams = async () => {
    if (!confirm("Are you sure you want to end ALL active streams? This will affect all publishers.")) {
      return
    }

    setActionLoading("end-all")
    setError("")
    setSuccess("")

    try {
      const result = await endAllActiveStreams()
      if (result.success) {
        setSuccess(`Successfully ended ${result.endedCount} active streams`)
        await loadData()
      } else {
        setError(result.error || "Failed to end all streams")
      }
    } catch (err: any) {
      setError("Failed to end all streams")
    } finally {
      setActionLoading(null)
    }
  }

  const getPublisherName = (publisherId: string) => {
    const publisher = publishers.find((p) => p.id === publisherId)
    return publisher?.displayName || publisher?.email || "Unknown Publisher"
  }

  const formatDuration = (start: Date, end?: Date) => {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const duration = Math.floor((endTime - startTime) / 1000 / 60) // minutes

    if (duration < 60) {
      return `${duration}m`
    }

    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeStreams.length}</div>
            <p className="text-xs text-muted-foreground">Currently streaming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allStreams.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publishers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishers.length}</div>
            <p className="text-xs text-muted-foreground">Registered</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Active Streams Management */}
      {activeStreams.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Video className="h-5 w-5 text-red-600" />
                  <span>Active Streams</span>
                  <Badge variant="destructive">{activeStreams.length}</Badge>
                </CardTitle>
                <CardDescription>Manage currently active streams</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleEndAllStreams}
                  disabled={actionLoading === "end-all"}
                >
                  {actionLoading === "end-all" ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Power className="h-4 w-4 mr-2" />
                  )}
                  End All Streams
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Room ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStreams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell className="font-medium">
                      {getPublisherName(stream.publisherId)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{stream.title || "Untitled Stream"}</p>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground">{stream.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {stream.roomId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(stream.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDuration(stream.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span>LIVE</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEndStream(stream.id!)}
                          disabled={actionLoading === stream.id}
                        >
                          {actionLoading === stream.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Streams History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>All Streams</span>
              </CardTitle>
              <CardDescription>Complete history of all streams</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allStreams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No streams found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Room ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStreams.map((stream) => (
                  <TableRow key={stream.id}>
                    <TableCell className="font-medium">
                      {getPublisherName(stream.publisherId)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{stream.title || "Untitled Stream"}</p>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground">{stream.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {stream.roomId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(stream.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDuration(stream.createdAt, stream.endedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stream.isActive ? "destructive" : "secondary"}>
                        {stream.isActive ? "LIVE" : "Ended"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {stream.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEndStream(stream.id!)}
                            disabled={actionLoading === stream.id}
                          >
                            {actionLoading === stream.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStream(stream.id!)}
                          disabled={actionLoading === stream.id}
                        >
                          {actionLoading === stream.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
