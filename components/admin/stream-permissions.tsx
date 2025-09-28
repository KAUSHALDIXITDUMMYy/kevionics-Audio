"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  createStreamPermission,
  getStreamPermissions,
  updateStreamPermission,
  deleteStreamPermission,
  getUsersByRole,
  type StreamPermission,
} from "@/lib/admin"
import type { UserProfile } from "@/lib/auth"
import { Plus, Video, Volume2, Trash2 } from "lucide-react"

export function StreamPermissions() {
  const [permissions, setPermissions] = useState<StreamPermission[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [subscribers, setSubscribers] = useState<(UserProfile & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Create permission form state
  const [selectedPublisher, setSelectedPublisher] = useState("")
  const [selectedSubscriber, setSelectedSubscriber] = useState("")
  const [allowVideo, setAllowVideo] = useState(true)
  const [allowAudio, setAllowAudio] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [permissionsData, publishersData, subscribersData] = await Promise.all([
      getStreamPermissions(),
      getUsersByRole("publisher"),
      getUsersByRole("subscriber"),
    ])

    setPermissions(permissionsData)
    setPublishers(publishersData as (UserProfile & { id: string })[])
    setSubscribers(subscribersData as (UserProfile & { id: string })[])
    setLoading(false)
  }

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    setError("")
    setSuccess("")

    const result = await createStreamPermission({
      publisherId: selectedPublisher,
      subscriberId: selectedSubscriber,
      allowVideo,
      allowAudio,
      isActive: true,
    })

    if (result.success) {
      setSuccess("Stream permission created successfully")
      setSelectedPublisher("")
      setSelectedSubscriber("")
      setAllowVideo(true)
      setAllowAudio(true)
      setShowCreateForm(false)
      loadData()
    } else {
      setError(result.error || "Failed to create permission")
    }

    setCreateLoading(false)
  }

  const handleTogglePermissionStatus = async (permissionId: string, currentStatus: boolean) => {
    const result = await updateStreamPermission(permissionId, { isActive: !currentStatus })
    if (result.success) {
      loadData()
    } else {
      setError(result.error || "Failed to update permission")
    }
  }

  const handleToggleVideo = async (permissionId: string, currentValue: boolean) => {
    const result = await updateStreamPermission(permissionId, { allowVideo: !currentValue })
    if (result.success) {
      loadData()
    } else {
      setError(result.error || "Failed to update video permission")
    }
  }

  const handleToggleAudio = async (permissionId: string, currentValue: boolean) => {
    const result = await updateStreamPermission(permissionId, { allowAudio: !currentValue })
    if (result.success) {
      loadData()
    } else {
      setError(result.error || "Failed to update audio permission")
    }
  }

  const handleDeletePermission = async (permissionId: string) => {
    if (confirm("Are you sure you want to delete this permission?")) {
      const result = await deleteStreamPermission(permissionId)
      if (result.success) {
        loadData()
      } else {
        setError(result.error || "Failed to delete permission")
      }
    }
  }

  const getPublisherName = (publisherId: string) => {
    const publisher = publishers.find((p) => p.id === publisherId)
    return publisher?.displayName || publisher?.email || "Unknown"
  }

  const getSubscriberName = (subscriberId: string) => {
    const subscriber = subscribers.find((s) => s.id === subscriberId)
    return subscriber?.displayName || subscriber?.email || "Unknown"
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
      {/* Create Permission Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stream Permissions</CardTitle>
              <CardDescription>Control which subscribers can access which publisher streams</CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Permission
            </Button>
          </div>
        </CardHeader>

        {showCreateForm && (
          <CardContent className="border-t">
            <form onSubmit={handleCreatePermission} className="space-y-4 max-w-md">
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
                <label className="text-sm font-medium">Publisher</label>
                <Select value={selectedPublisher} onValueChange={setSelectedPublisher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a publisher" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishers.map((publisher) => (
                      <SelectItem key={publisher.id} value={publisher.id}>
                        {publisher.displayName || publisher.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subscriber</label>
                <Select value={selectedSubscriber} onValueChange={setSelectedSubscriber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a subscriber" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscribers.map((subscriber) => (
                      <SelectItem key={subscriber.id} value={subscriber.id}>
                        {subscriber.displayName || subscriber.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Permissions</label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="allowVideo" checked={allowVideo} onCheckedChange={setAllowVideo} />
                  <label htmlFor="allowVideo" className="text-sm">
                    Allow Video
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="allowAudio" checked={allowAudio} onCheckedChange={setAllowAudio} />
                  <label htmlFor="allowAudio" className="text-sm">
                    Allow Audio
                  </label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={createLoading || !selectedPublisher || !selectedSubscriber}>
                  {createLoading ? "Creating..." : "Create Permission"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Permissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Permissions</CardTitle>
          <CardDescription>Manage existing stream permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publisher</TableHead>
                <TableHead>Subscriber</TableHead>
                <TableHead>Video</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{getPublisherName(permission.publisherId)}</TableCell>
                  <TableCell>{getSubscriberName(permission.subscriberId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={permission.allowVideo}
                        onCheckedChange={() => handleToggleVideo(permission.id!, permission.allowVideo)}
                      />
                      <Video className={`h-4 w-4 ${permission.allowVideo ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={permission.allowAudio}
                        onCheckedChange={() => handleToggleAudio(permission.id!, permission.allowAudio)}
                      />
                      <Volume2 className={`h-4 w-4 ${permission.allowAudio ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={permission.isActive ? "default" : "secondary"}>
                      {permission.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(permission.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={permission.isActive}
                        onCheckedChange={() => handleTogglePermissionStatus(permission.id!, permission.isActive)}
                      />
                      <Button variant="outline" size="sm" onClick={() => handleDeletePermission(permission.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
