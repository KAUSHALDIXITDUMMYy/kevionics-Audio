import { db } from "./firebase"
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore"

export interface ViewerSession {
  id?: string
  subscriberId: string
  subscriberName: string
  subscriberEmail: string
  publisherId: string
  publisherName: string
  streamId: string
  streamTitle?: string
  roomId: string
  joinedAt: Date
  leftAt?: Date
  duration?: number // in seconds
  isActive: boolean
  userAgent?: string
  ipAddress?: string
}

export interface StreamAnalytics {
  streamId: string
  publisherId: string
  publisherName: string
  streamTitle?: string
  roomId: string
  totalViewers: number
  currentViewers: number
  totalDuration: number // in seconds
  peakViewers: number
  averageViewers: number
  createdAt: Date
  endedAt?: Date
  isActive: boolean
}

export interface PublisherAnalytics {
  publisherId: string
  publisherName: string
  totalStreams: number
  totalViewers: number
  totalDuration: number
  averageViewersPerStream: number
  peakViewers: number
  lastStreamAt?: Date
}

export interface AdminAnalytics {
  totalSubscribers: number
  totalPublishers: number
  activeStreams: number
  totalActiveViewers: number
  totalStreamsToday: number
  averageViewersPerStream: number
  peakViewersToday: number
}

// Create a new viewer session when someone joins a stream
export const createViewerSession = async (sessionData: Omit<ViewerSession, "id" | "joinedAt" | "isActive">) => {
  try {
    const session = {
      ...sessionData,
      joinedAt: new Date(),
      isActive: true,
    }
    
    const docRef = await addDoc(collection(db, "viewerSessions"), session)
    return { success: true, id: docRef.id, session: { ...session, id: docRef.id } }
  } catch (error: any) {
    console.error("Error creating viewer session:", error)
    return { success: false, error: error.message }
  }
}

// End a viewer session when someone leaves a stream
export const endViewerSession = async (sessionId: string) => {
  try {
    const leftAt = new Date()
    const sessionRef = doc(db, "viewerSessions", sessionId)
    
    // Get the session to calculate duration
    const sessionDoc = await getDocs(query(collection(db, "viewerSessions"), where("__name__", "==", sessionId)))
    if (sessionDoc.empty) {
      return { success: false, error: "Session not found" }
    }
    
    const sessionData = sessionDoc.docs[0].data()
    const joinedAt = sessionData.joinedAt.toDate()
    const duration = Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000)
    
    await updateDoc(sessionRef, {
      leftAt,
      duration,
      isActive: false,
    })
    
    return { success: true }
  } catch (error: any) {
    console.error("Error ending viewer session:", error)
    return { success: false, error: error.message }
  }
}

// Get active viewers for a specific stream
export const getActiveViewers = async (streamId: string): Promise<ViewerSession[]> => {
  try {
    const sessionsRef = collection(db, "viewerSessions")
    const q = query(
      sessionsRef,
      where("streamId", "==", streamId),
      where("isActive", "==", true)
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
  } catch (error) {
    console.error("Error fetching active viewers:", error)
    return []
  }
}

// Get all active viewers across all streams
export const getAllActiveViewers = async (): Promise<ViewerSession[]> => {
  try {
    const sessionsRef = collection(db, "viewerSessions")
    const q = query(
      sessionsRef,
      where("isActive", "==", true)
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
  } catch (error) {
    console.error("Error fetching all active viewers:", error)
    return []
  }
}

// Get analytics for a specific publisher
export const getPublisherAnalytics = async (publisherId: string): Promise<PublisherAnalytics> => {
  try {
    // Get all streams for this publisher
    const streamsRef = collection(db, "streamSessions")
    const streamsQuery = query(streamsRef, where("publisherId", "==", publisherId))
    const streamsSnapshot = await getDocs(streamsQuery)
    
    const streams = streamsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    
    // Get all viewer sessions for this publisher's streams
    const sessionsRef = collection(db, "viewerSessions")
    const sessionsQuery = query(sessionsRef, where("publisherId", "==", publisherId))
    const sessionsSnapshot = await getDocs(sessionsQuery)
    
    const sessions = sessionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
    
    // Calculate analytics
    const totalStreams = streams.length
    const totalViewers = sessions.length
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0)
    const averageViewersPerStream = totalStreams > 0 ? totalViewers / totalStreams : 0
    const peakViewers = Math.max(...sessions.map(s => 1), 0) // Simplified for now
    
    const lastStream = streams
      .filter(s => s.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    
    return {
      publisherId,
      publisherName: streams[0]?.publisherName || "Unknown",
      totalStreams,
      totalViewers,
      totalDuration,
      averageViewersPerStream,
      peakViewers,
      lastStreamAt: lastStream?.createdAt ? new Date(lastStream.createdAt) : undefined,
    }
  } catch (error) {
    console.error("Error fetching publisher analytics:", error)
    return {
      publisherId,
      publisherName: "Unknown",
      totalStreams: 0,
      totalViewers: 0,
      totalDuration: 0,
      averageViewersPerStream: 0,
      peakViewers: 0,
    }
  }
}

// Get admin analytics overview
export const getAdminAnalytics = async (): Promise<AdminAnalytics> => {
  try {
    // Get all users
    const usersRef = collection(db, "users")
    const usersSnapshot = await getDocs(usersRef)
    const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    const subscribers = users.filter(user => user.role === "subscriber")
    const publishers = users.filter(user => user.role === "publisher")
    
    // Get active streams
    const streamsRef = collection(db, "streamSessions")
    const activeStreamsQuery = query(streamsRef, where("isActive", "==", true))
    const activeStreamsSnapshot = await getDocs(activeStreamsQuery)
    const activeStreams = activeStreamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    // Get all active viewers
    const activeViewers = await getAllActiveViewers()
    
    // Get today's streams
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStreamsQuery = query(
      streamsRef,
      where("createdAt", ">=", Timestamp.fromDate(today))
    )
    const todayStreamsSnapshot = await getDocs(todayStreamsQuery)
    const todayStreams = todayStreamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    
    // Calculate analytics
    const totalActiveViewers = activeViewers.length
    const totalStreamsToday = todayStreams.length
    const averageViewersPerStream = activeStreams.length > 0 ? totalActiveViewers / activeStreams.length : 0
    
    // Calculate peak viewers today (simplified)
    const peakViewersToday = Math.max(totalActiveViewers, 0)
    
    return {
      totalSubscribers: subscribers.length,
      totalPublishers: publishers.length,
      activeStreams: activeStreams.length,
      totalActiveViewers,
      totalStreamsToday,
      averageViewersPerStream,
      peakViewersToday,
    }
  } catch (error) {
    console.error("Error fetching admin analytics:", error)
    return {
      totalSubscribers: 0,
      totalPublishers: 0,
      activeStreams: 0,
      totalActiveViewers: 0,
      totalStreamsToday: 0,
      averageViewersPerStream: 0,
      peakViewersToday: 0,
    }
  }
}

// Real-time subscription to active viewers for a stream
export const subscribeToActiveViewers = (
  streamId: string, 
  callback: (viewers: ViewerSession[]) => void
): (() => void) => {
  const sessionsRef = collection(db, "viewerSessions")
  const q = query(
    sessionsRef,
    where("streamId", "==", streamId),
    where("isActive", "==", true)
  )
  
  return onSnapshot(q, (snapshot) => {
    const viewers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
    callback(viewers)
  })
}

// Real-time subscription to all active viewers
export const subscribeToAllActiveViewers = (
  callback: (viewers: ViewerSession[]) => void
): (() => void) => {
  const sessionsRef = collection(db, "viewerSessions")
  const q = query(
    sessionsRef,
    where("isActive", "==", true)
  )
  
  return onSnapshot(q, (snapshot) => {
    const viewers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
    callback(viewers)
  })
}

// Get viewer history for a specific stream
export const getStreamViewerHistory = async (streamId: string): Promise<ViewerSession[]> => {
  try {
    const sessionsRef = collection(db, "viewerSessions")
    const q = query(
      sessionsRef,
      where("streamId", "==", streamId),
      orderBy("joinedAt", "desc")
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ViewerSession[]
  } catch (error) {
    console.error("Error fetching stream viewer history:", error)
    return []
  }
}
