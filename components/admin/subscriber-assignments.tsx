"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getUsersByRole, getStreamPermissions, createStreamPermission, deleteStreamPermission, updateStreamPermission, type StreamPermission } from "@/lib/admin"
import type { UserProfile } from "@/lib/auth"
import { permissionsManager } from "@/lib/permissions"
import { Video, Volume2, X } from "lucide-react"

export function SubscriberAssignments() {
  const [subscribers, setSubscribers] = useState<(UserProfile & { id: string })[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [subscriberPermissions, setSubscriberPermissions] = useState<StreamPermission[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [subs, pubs] = await Promise.all([getUsersByRole("subscriber"), getUsersByRole("publisher")])
      setSubscribers(subs as any)
      setPublishers(pubs as any)
      setLoading(false)
      if (subs.length > 0) setSelectedSubscriberId((subs as any)[0].id)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedSubscriberId) return
    const unsubscribe = permissionsManager.subscribeToUserPermissions(selectedSubscriberId, (perms) => {
      setSubscriberPermissions(perms)
    })
    return () => unsubscribe()
  }, [selectedSubscriberId])

  const filteredSubscribers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter((s) => (s.displayName || s.email).toLowerCase().includes(q))
  }, [search, subscribers])

  const assignedPublisherIds = useMemo(() => new Set(subscriberPermissions.map((p) => p.publisherId)), [subscriberPermissions])

  const toggleAssignment = async (publisherId: string, nextAssigned: boolean) => {
    if (!selectedSubscriberId) return
    setError("")
    setSuccess("")

    const existing = subscriberPermissions.find((p) => p.publisherId === publisherId)
    try {
      if (nextAssigned) {
        if (!existing) {
          await createStreamPermission({
            publisherId,
            subscriberId: selectedSubscriberId,
            allowVideo: true,
            allowAudio: true,
            isActive: true,
          })
          setSuccess("Assigned")
        } else if (!existing.isActive) {
          await updateStreamPermission(existing.id!, { isActive: true })
          setSuccess("Re-activated assignment")
        }
      } else {
        if (existing) {
          await deleteStreamPermission(existing.id!)
          setSuccess("Unassigned")
        }
      }
    } catch (e: any) {
      setError(e?.message || "Operation failed")
    }
  }

  const setPermissionBit = async (publisherId: string, key: "allowVideo" | "allowAudio", value: boolean) => {
    const existing = subscriberPermissions.find((p) => p.publisherId === publisherId)
    if (!existing) return
    try {
      await updateStreamPermission(existing.id!, { [key]: value } as any)
      setSuccess("Updated")
    } catch (e: any) {
      setError(e?.message || "Update failed")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">Loading...</CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
          <CardDescription>Select a subscriber to manage assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search subscribers" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ScrollArea className="h-[480px]">
            <div className="space-y-2">
              {filteredSubscribers.map((s) => (
                <button
                  key={s.id}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    selectedSubscriberId === s.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedSubscriberId(s.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.displayName || s.email}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                    <Badge variant="outline">{s.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Assign Publishers</CardTitle>
          <CardDescription>
            Toggle to assign/unassign. Click icons to enable/disable video/audio per assignment.
          </CardDescription>
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

          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-3">
              {publishers.map((p) => {
                const assigned = assignedPublisherIds.has(p.id)
                const perm = subscriberPermissions.find((sp) => sp.publisherId === p.id)
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{p.displayName || p.email}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={assigned} onCheckedChange={(v) => toggleAssignment(p.id, Boolean(v))} />
                        <span className="text-sm">Assigned</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={!assigned}
                          className={`p-1 rounded ${perm?.allowVideo ? "text-green-600" : "text-gray-400"}`}
                          onClick={() => setPermissionBit(p.id, "allowVideo", !perm?.allowVideo)}
                          title="Toggle video"
                        >
                          <Video className="h-4 w-4" />
                        </button>
                        <button
                          disabled={!assigned}
                          className={`p-1 rounded ${perm?.allowAudio ? "text-green-600" : "text-gray-400"}`}
                          onClick={() => setPermissionBit(p.id, "allowAudio", !perm?.allowAudio)}
                          title="Toggle audio"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                        {assigned && (
                          <Button variant="outline" size="icon" title="Unassign" onClick={() => toggleAssignment(p.id, false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}


