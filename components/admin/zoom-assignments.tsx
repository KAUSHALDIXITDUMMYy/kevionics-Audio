"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getUsersByRole } from "@/lib/admin"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { assignSubscriberToZoomCall, subscribeAllZoomCalls, unassignSubscriberFromZoomCall, type ZoomCall, type ZoomCallAssignment } from "@/lib/zoom"
import { assignSubscriberToPublisherZoom, unassignSubscriberFromPublisherZoom } from "@/lib/zoom"

export function ZoomAssignmentsAdmin() {
  const [zoomCalls, setZoomCalls] = useState<ZoomCall[]>([])
  const [publishers, setPublishers] = useState<any[]>([])
  const [selectedPublisherId, setSelectedPublisherId] = useState("")
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [searchSubs, setSearchSubs] = useState("")
  const [searchPublishers, setSearchPublishers] = useState("")
  const [assignments, setAssignments] = useState<any[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      const pubs = await getUsersByRole("publisher" as any)
      setPublishers(pubs as any)
    }
    load()
  }, [])

  useEffect(() => {
    ;(async () => {
      const subs = await getUsersByRole("subscriber" as any)
      setSubscribers(subs as any)
    })()
  }, [])

  useEffect(() => {
    if (!selectedPublisherId) return
    const qA = query(collection(db, "zoomPublisherAssignments"), where("publisherId", "==", selectedPublisherId))
    const unsub = onSnapshot(qA, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
      setAssignments(rows)
    })
    return () => unsub()
  }, [selectedPublisherId])

  const filteredPublishers = useMemo(() => {
    const q = searchPublishers.trim().toLowerCase()
    if (!q) return publishers
    return publishers.filter((p) => (p.displayName || p.email).toLowerCase().includes(q))
  }, [searchPublishers, publishers])

  const filteredSubscribers = useMemo(() => {
    const q = searchSubs.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter((s) => (s.displayName || s.email).toLowerCase().includes(q))
  }, [searchSubs, subscribers])

  const assignedMap = useMemo(() => {
    const m = new Map<string, any>()
    assignments.forEach((a) => m.set(a.subscriberId, a))
    return m
  }, [assignments])

  const toggle = async (subscriberId: string, next: boolean) => {
    if (!selectedPublisherId) return
    setError("")
    try {
      const existing = assignedMap.get(subscriberId)
      if (next && !existing) {
        await assignSubscriberToPublisherZoom(selectedPublisherId, subscriberId)
      } else if (!next && existing?.id) {
        await unassignSubscriberFromPublisherZoom(existing.id)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to update assignment")
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Publishers</CardTitle>
          <CardDescription>Select a publisher to assign subscribers for their Zoom calls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search publishers" value={searchPublishers} onChange={(e) => setSearchPublishers(e.target.value)} />
          <ScrollArea className="h-[480px]">
            <div className="space-y-2">
              {filteredPublishers.map((p) => (
                <button
                  key={p.id}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    selectedPublisherId === p.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedPublisherId(p.id!)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.displayName || p.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    <Badge variant="outline">Publisher</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Assign Subscribers</CardTitle>
          <CardDescription>Assign subscribers to receive all active Zoom calls from the selected publisher.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Input
            placeholder="Search subscribers"
            value={searchSubs}
            onChange={(e) => setSearchSubs(e.target.value)}
          />

          <ScrollArea className="h-[520px] pr-2">
            <div className="space-y-3">
              {selectedPublisherId ? (
                filteredSubscribers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No subscribers found.</div>
                ) : (
                  filteredSubscribers.map((s) => {
                    const assigned = assignedMap.has(s.id)
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{s.displayName || s.email}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={assigned} onCheckedChange={(v) => toggle(s.id, Boolean(v))} />
                            <span className="text-sm">Assigned</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )
              ) : (
                <div className="text-sm text-muted-foreground">Select a publisher to assign subscribers.</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
