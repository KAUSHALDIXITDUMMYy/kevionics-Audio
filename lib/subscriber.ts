import { db } from "./firebase"
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore"
import type { StreamPermission } from "./admin"
import type { StreamSession } from "./streaming"

export interface SubscriberPermission extends StreamPermission {
  publisherName: string
  streamSession?: StreamSession
}

// ============================================================================
// USER CACHE - Dramatically reduces Firestore reads by caching user data
// ============================================================================
interface CachedUser {
  uid: string
  displayName?: string
  email?: string
}

class UserCache {
  private cache = new Map<string, CachedUser>()
  private lastFullFetch: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache TTL
  private unsubscribe: (() => void) | null = null

  // Get a single user - fetches from cache or Firestore
  async getUser(uid: string): Promise<CachedUser | null> {
    // Check cache first
    if (this.cache.has(uid)) {
      return this.cache.get(uid)!
    }
    
    // Fetch single user from Firestore
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const cached: CachedUser = {
          uid: userData.uid,
          displayName: userData.displayName,
          email: userData.email,
        }
        this.cache.set(uid, cached)
        return cached
      }
    } catch (error) {
      console.error("[UserCache] Failed to fetch user:", uid, error)
    }
    return null
  }

  // Get multiple users efficiently - only fetches missing ones
  async getUsers(uids: string[]): Promise<Map<string, CachedUser>> {
    const result = new Map<string, CachedUser>()
    const missingUids: string[] = []

    // Check what's already cached
    for (const uid of uids) {
      if (this.cache.has(uid)) {
        result.set(uid, this.cache.get(uid)!)
      } else {
        missingUids.push(uid)
      }
    }

    // Fetch only missing users (if any)
    if (missingUids.length > 0) {
      console.log("[UserCache] Fetching", missingUids.length, "users from Firestore")
      for (const uid of missingUids) {
        const user = await this.getUser(uid)
        if (user) {
          result.set(uid, user)
        }
      }
    }

    return result
  }

  // Pre-warm cache with all users (call sparingly, e.g., on app init)
  async warmCache(): Promise<void> {
    const now = Date.now()
    if (now - this.lastFullFetch < this.CACHE_TTL) {
      console.log("[UserCache] Cache still warm, skipping full fetch")
      return
    }

    try {
      console.log("[UserCache] Warming cache with all users...")
      const usersRef = collection(db, "users")
      const snapshot = await getDocs(usersRef)
      
      snapshot.docs.forEach((doc) => {
        const userData = doc.data()
        this.cache.set(userData.uid, {
          uid: userData.uid,
          displayName: userData.displayName,
          email: userData.email,
        })
      })
      
      this.lastFullFetch = now
      console.log("[UserCache] Cached", this.cache.size, "users")
    } catch (error) {
      console.error("[UserCache] Failed to warm cache:", error)
    }
  }

  // Start real-time listener to keep cache updated (prevents stale data)
  startRealtimeSync(): void {
    if (this.unsubscribe) return // Already listening

    const usersRef = collection(db, "users")
    this.unsubscribe = onSnapshot(usersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const userData = change.doc.data()
        const cached: CachedUser = {
          uid: userData.uid,
          displayName: userData.displayName,
          email: userData.email,
        }
        
        if (change.type === "added" || change.type === "modified") {
          this.cache.set(userData.uid, cached)
        } else if (change.type === "removed") {
          this.cache.delete(userData.uid)
        }
      })
    })
    console.log("[UserCache] Started real-time sync")
  }

  stopRealtimeSync(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      console.log("[UserCache] Stopped real-time sync")
    }
  }

  clear(): void {
    this.cache.clear()
    this.lastFullFetch = 0
  }
}

// Singleton cache instance
export const userCache = new UserCache()

// ============================================================================
// OPTIMIZED SUBSCRIBER FUNCTIONS
// ============================================================================

export const getSubscriberPermissions = async (subscriberId: string): Promise<SubscriberPermission[]> => {
  try {
    console.log("[v0] Fetching permissions for subscriber:", subscriberId)

    // Get permissions for this subscriber
    const permissionsRef = collection(db, "streamPermissions")
    const permissionsQuery = query(
      permissionsRef,
      where("subscriberId", "==", subscriberId),
      where("isActive", "==", true),
    )
    const permissionsSnapshot = await getDocs(permissionsQuery)
    const permissions = permissionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StreamPermission[]

    console.log("[v0] Found permissions:", permissions.length)

    // Only fetch active streams (NOT all users anymore!)
    const streamsRef = collection(db, "streamSessions")
    const streamsSnapshot = await getDocs(query(streamsRef, where("isActive", "==", true)))

    const activeStreamsMap = new Map()
    streamsSnapshot.docs.forEach((doc) => {
      const streamData = { id: doc.id, ...doc.data() } as any
      const existing = activeStreamsMap.get(streamData.publisherId)
      if (!existing) {
        activeStreamsMap.set(streamData.publisherId, streamData)
        return
      }
      // Keep the latest by createdAt
      const existingCreated = new Date(existing.createdAt).getTime()
      const currentCreated = new Date(streamData.createdAt).getTime()
      if (currentCreated > existingCreated) {
        activeStreamsMap.set(streamData.publisherId, streamData)
      }
    })

    console.log("[v0] Active streams found:", activeStreamsMap.size)

    // Only fetch users we actually need (publishers with permissions)
    const publisherIds = [...new Set(permissions.map(p => p.publisherId))]
    const usersMap = await userCache.getUsers(publisherIds)

    const enrichedPermissions: SubscriberPermission[] = permissions.map((permission) => {
      const publisherData = usersMap.get(permission.publisherId)
      const streamData = activeStreamsMap.get(permission.publisherId)

      return {
        ...permission,
        publisherName: publisherData?.displayName || publisherData?.email || "Unknown Publisher",
        streamSession: streamData || undefined,
      } as SubscriberPermission
    })

    console.log("[v0] Enriched permissions:", enrichedPermissions.length)
    return enrichedPermissions
  } catch (error) {
    console.error("Error fetching subscriber permissions:", error)
    return []
  }
}

export const getAvailableStreams = async (subscriberId: string): Promise<SubscriberPermission[]> => {
  const permissions = await getSubscriberPermissions(subscriberId)
  const availableStreams = permissions.filter((permission) => permission.streamSession?.isActive)
  console.log("[v0] Available streams for subscriber:", availableStreams.length)
  return availableStreams
}

// ============================================================================
// REAL-TIME STREAM SUBSCRIPTION (Replaces polling!)
// ============================================================================
export interface StreamSubscriptionCallbacks {
  onStreamsUpdate: (streams: SubscriberPermission[]) => void
  onError?: (error: Error) => void
}

/**
 * Subscribe to real-time stream updates for a subscriber.
 * This REPLACES polling and dramatically reduces Firestore reads.
 * 
 * Returns an unsubscribe function to call on cleanup.
 */
export const subscribeToAvailableStreams = (
  subscriberId: string,
  callbacks: StreamSubscriptionCallbacks
): (() => void) => {
  let permissionsUnsubscribe: (() => void) | null = null
  let streamsUnsubscribe: (() => void) | null = null
  
  // Local state to merge permissions and streams
  let currentPermissions: StreamPermission[] = []
  let activeStreams = new Map<string, StreamSession>()

  const emitUpdate = async () => {
    try {
      // Get publisher user data (from cache, minimal reads)
      const publisherIds = [...new Set(currentPermissions.map(p => p.publisherId))]
      const usersMap = await userCache.getUsers(publisherIds)

      const enrichedPermissions: SubscriberPermission[] = currentPermissions.map((permission) => {
        const publisherData = usersMap.get(permission.publisherId)
        const streamData = activeStreams.get(permission.publisherId)

        return {
          ...permission,
          publisherName: publisherData?.displayName || publisherData?.email || "Unknown Publisher",
          streamSession: streamData || undefined,
        } as SubscriberPermission
      })

      // Filter to only available (active) streams
      const availableStreams = enrichedPermissions.filter(p => p.streamSession?.isActive)
      callbacks.onStreamsUpdate(availableStreams)
    } catch (error) {
      callbacks.onError?.(error as Error)
    }
  }

  // Listen to permissions changes
  const permissionsRef = collection(db, "streamPermissions")
  const permissionsQuery = query(
    permissionsRef,
    where("subscriberId", "==", subscriberId),
    where("isActive", "==", true)
  )
  
  permissionsUnsubscribe = onSnapshot(
    permissionsQuery,
    (snapshot) => {
      currentPermissions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StreamPermission[]
      emitUpdate()
    },
    (error) => {
      console.error("[subscribeToAvailableStreams] Permissions error:", error)
      callbacks.onError?.(error)
    }
  )

  // Listen to active streams changes
  const streamsRef = collection(db, "streamSessions")
  const streamsQuery = query(streamsRef, where("isActive", "==", true))
  
  streamsUnsubscribe = onSnapshot(
    streamsQuery,
    (snapshot) => {
      activeStreams.clear()
      snapshot.docs.forEach((doc) => {
        const streamData = { id: doc.id, ...doc.data() } as StreamSession
        const existing = activeStreams.get(streamData.publisherId)
        if (!existing) {
          activeStreams.set(streamData.publisherId, streamData)
          return
        }
        // Keep the latest by createdAt
        const existingCreated = new Date(existing.createdAt).getTime()
        const currentCreated = new Date(streamData.createdAt).getTime()
        if (currentCreated > existingCreated) {
          activeStreams.set(streamData.publisherId, streamData)
        }
      })
      emitUpdate()
    },
    (error) => {
      console.error("[subscribeToAvailableStreams] Streams error:", error)
      callbacks.onError?.(error)
    }
  )

  // Return cleanup function
  return () => {
    permissionsUnsubscribe?.()
    streamsUnsubscribe?.()
  }
}
