"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { getUsersByRole, createStreamPermission, deleteStreamPermission } from "@/lib/admin"
import type { UserProfile } from "@/lib/auth"
import { permissionsManager } from "@/lib/permissions"
import { Users, UserCheck, CheckSquare, Square, ArrowRight } from "lucide-react"

export function SubscriberAssignments() {
  const [subscribers, setSubscribers] = useState<(UserProfile & { id: string })[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<Set<string>>(new Set())
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<Set<string>>(new Set())
  const [subscriberSearch, setSubscriberSearch] = useState("")
  const [publisherSearch, setPublisherSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [subs, pubs] = await Promise.all([
        getUsersByRole("subscriber"),
        getUsersByRole("publisher")
      ])
      setSubscribers(subs as any)
      setPublishers(pubs as any)
      setLoading(false)
    }
    load()
  }, [])

  const filteredSubscribers = useMemo(() => {
    const q = subscriberSearch.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter((s) => 
      (s.displayName || s.email).toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    )
  }, [subscriberSearch, subscribers])

  const filteredPublishers = useMemo(() => {
    const q = publisherSearch.trim().toLowerCase()
    if (!q) return publishers
    return publishers.filter((p) =>
      (p.displayName || p.email).toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    )
  }, [publisherSearch, publishers])

  const toggleSubscriber = (id: string) => {
    const newSet = new Set(selectedSubscriberIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedSubscriberIds(newSet)
  }

  const togglePublisher = (id: string) => {
    const newSet = new Set(selectedPublisherIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedPublisherIds(newSet)
  }

  const selectAllSubscribers = () => {
    setSelectedSubscriberIds(new Set(filteredSubscribers.map(s => s.id)))
  }

  const deselectAllSubscribers = () => {
    setSelectedSubscriberIds(new Set())
  }

  const selectAllPublishers = () => {
    setSelectedPublisherIds(new Set(filteredPublishers.map(p => p.id)))
  }

  const deselectAllPublishers = () => {
    setSelectedPublisherIds(new Set())
  }

  const assignSelected = async () => {
    if (selectedSubscriberIds.size === 0 || selectedPublisherIds.size === 0) {
      setError("Please select at least one subscriber and one publisher")
      return
    }

    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      let created = 0
      let skipped = 0

      for (const subscriberId of selectedSubscriberIds) {
        for (const publisherId of selectedPublisherIds) {
          try {
            await createStreamPermission({
              publisherId,
              subscriberId,
              allowVideo: true,
              allowAudio: true,
              isActive: true,
            })
            created++
          } catch (e: any) {
            // Permission might already exist
            if (e?.message?.includes("already exists")) {
              skipped++
            }
          }
        }
      }

      setSuccess(`✅ Assigned ${created} new permissions${skipped > 0 ? `, ${skipped} already existed` : ""}`)
      
      // Clear selections after successful assignment
      setSelectedSubscriberIds(new Set())
      setSelectedPublisherIds(new Set())
    } catch (e: any) {
      setError(e?.message || "Assignment failed")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Action Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Publisher Assignment
          </CardTitle>
          <CardDescription>
            Select multiple subscribers and publishers to create assignments in bulk
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

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="font-medium">Selected:</span>
                <Badge variant="secondary">{selectedSubscriberIds.size} Subscribers</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{selectedPublisherIds.size} Publishers</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                This will create {selectedSubscriberIds.size * selectedPublisherIds.size} assignments
              </p>
            </div>
            <Button 
              onClick={assignSelected}
              disabled={processing || selectedSubscriberIds.size === 0 || selectedPublisherIds.size === 0}
              size="lg"
            >
              {processing ? "Assigning..." : "Assign Selected"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscribers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Subscribers</CardTitle>
                <CardDescription>
                  {selectedSubscriberIds.size} of {filteredSubscribers.length} selected
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={selectAllSubscribers}
                  disabled={filteredSubscribers.length === 0}
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={deselectAllSubscribers}
                  disabled={selectedSubscriberIds.size === 0}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              placeholder="Search subscribers..." 
              value={subscriberSearch} 
              onChange={(e) => setSubscriberSearch(e.target.value)} 
            />
            <Separator />
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {filteredSubscribers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No subscribers found
                  </div>
                ) : (
                  filteredSubscribers.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSubscriberIds.has(s.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => toggleSubscriber(s.id)}
                    >
                      <Checkbox
                        checked={selectedSubscriberIds.has(s.id)}
                        onCheckedChange={() => toggleSubscriber(s.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{s.displayName || s.email}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </div>
                      <Badge variant={s.isActive ? "default" : "secondary"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Publishers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Publishers</CardTitle>
                <CardDescription>
                  {selectedPublisherIds.size} of {filteredPublishers.length} selected
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={selectAllPublishers}
                  disabled={filteredPublishers.length === 0}
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={deselectAllPublishers}
                  disabled={selectedPublisherIds.size === 0}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              placeholder="Search publishers..." 
              value={publisherSearch} 
              onChange={(e) => setPublisherSearch(e.target.value)} 
            />
            <Separator />
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {filteredPublishers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No publishers found
                  </div>
                ) : (
                  filteredPublishers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPublisherIds.has(p.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => togglePublisher(p.id)}
                    >
                      <Checkbox
                        checked={selectedPublisherIds.has(p.id)}
                        onCheckedChange={() => togglePublisher(p.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{p.displayName || p.email}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
