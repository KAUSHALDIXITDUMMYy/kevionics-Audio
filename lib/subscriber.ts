import { db } from "./firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import type { StreamPermission } from "./admin"
import type { StreamSession } from "./streaming"

export interface SubscriberPermission extends StreamPermission {
  publisherName: string
  streamSession?: StreamSession
}

export const getSubscriberPermissions = async (subscriberId: string): Promise<SubscriberPermission[]> => {
  try {
    console.log("[v0] Fetching permissions for subscriber:", subscriberId)

    // Get permissions for this subscriber with simpler query
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

    // Get all users and active streams in parallel
    const usersRef = collection(db, "users")
    const streamsRef = collection(db, "streamSessions")

    const [usersSnapshot, streamsSnapshot] = await Promise.all([
      getDocs(usersRef),
      getDocs(query(streamsRef, where("isActive", "==", true))),
    ])

    // Create lookup maps for better performance
    const usersMap = new Map()
    usersSnapshot.docs.forEach((doc) => {
      const userData = doc.data()
      usersMap.set(userData.uid, userData)
    })

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

    const enrichedPermissions: SubscriberPermission[] = permissions.map((permission) => {
      const publisherData = usersMap.get(permission.publisherId)
      const streamData = activeStreamsMap.get(permission.publisherId)

      console.log("[v0] Processing permission for publisher:", permission.publisherId, "Stream active:", !!streamData)

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
