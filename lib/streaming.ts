import { db } from "./firebase"
import { collection, addDoc, doc, updateDoc, query, where, getDocs, deleteDoc } from "firebase/firestore"

export interface StreamSession {
  id?: string
  publisherId: string
  publisherName: string
  roomId: string
  isActive: boolean
  createdAt: Date
  endedAt?: Date
  title?: string
  description?: string
  gameName?: string
  league?: string
  match?: string
}

export const createStreamSession = async (session: Omit<StreamSession, "id" | "createdAt">) => {
  try {
    // Ensure only one active stream per publisher by ending any existing active sessions
    const streamsRef = collection(db, "streamSessions")
    const activeForPublisherQuery = query(streamsRef, where("publisherId", "==", session.publisherId), where("isActive", "==", true))
    const activeSnapshot = await getDocs(activeForPublisherQuery)
    await Promise.all(
      activeSnapshot.docs.map(async (activeDoc) => {
        try {
          await updateDoc(doc(db, "streamSessions", activeDoc.id), {
            isActive: false,
            endedAt: new Date(),
          })
        } catch {
          // best-effort; do not block new session creation
        }
      }),
    )

    const sessionData = {
      ...session,
      createdAt: new Date(),
    }

    const docRef = await addDoc(collection(db, "streamSessions"), sessionData)
    return { success: true, id: docRef.id, session: { ...sessionData, id: docRef.id } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const endStreamSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "streamSessions", sessionId)
    await updateDoc(sessionRef, {
      isActive: false,
      endedAt: new Date(),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const getActiveStreams = async () => {
  try {
    const streamsRef = collection(db, "streamSessions")
    // Use simpler query to avoid index requirements
    const q = query(streamsRef, where("isActive", "==", true))
    const querySnapshot = await getDocs(q)

    const streams = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StreamSession[]

    // Sort by createdAt in memory to avoid composite index
    return streams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error fetching active streams:", error)
    return []
  }
}

export const getPublisherStreams = async (publisherId: string) => {
  try {
    const streamsRef = collection(db, "streamSessions")
    // Use simpler query to avoid index requirements
    const q = query(streamsRef, where("publisherId", "==", publisherId))
    const querySnapshot = await getDocs(q)

    const streams = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StreamSession[]

    // Sort by createdAt in memory to avoid composite index
    return streams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error fetching publisher streams:", error)
    return []
  }
}

export const generateRoomId = (publisherId: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `stream-${publisherId}-${timestamp}-${random}`
}

// End a specific stream session (for admin/publisher use)
export const endStreamSessionById = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "streamSessions", sessionId)
    await updateDoc(sessionRef, {
      isActive: false,
      endedAt: new Date(),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Delete a stream session completely (for cleanup)
export const deleteStreamSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "streamSessions", sessionId)
    await deleteDoc(sessionRef)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// End all active streams for a specific publisher
export const endAllPublisherStreams = async (publisherId: string) => {
  try {
    const streamsRef = collection(db, "streamSessions")
    const activeForPublisherQuery = query(streamsRef, where("publisherId", "==", publisherId), where("isActive", "==", true))
    const activeSnapshot = await getDocs(activeForPublisherQuery)
    
    const updatePromises = activeSnapshot.docs.map(async (activeDoc) => {
      try {
        await updateDoc(doc(db, "streamSessions", activeDoc.id), {
          isActive: false,
          endedAt: new Date(),
        })
      } catch (error) {
        console.error(`Failed to end stream ${activeDoc.id}:`, error)
      }
    })
    
    await Promise.all(updatePromises)
    return { success: true, endedCount: activeSnapshot.docs.length }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get all streams (active and inactive) for admin management
export const getAllStreams = async () => {
  try {
    const streamsRef = collection(db, "streamSessions")
    const querySnapshot = await getDocs(streamsRef)

    const streams = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StreamSession[]

    // Sort by createdAt in memory to avoid composite index
    return streams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error fetching all streams:", error)
    return []
  }
}

// End all active streams (admin function)
export const endAllActiveStreams = async () => {
  try {
    const streamsRef = collection(db, "streamSessions")
    const activeQuery = query(streamsRef, where("isActive", "==", true))
    const activeSnapshot = await getDocs(activeQuery)
    
    const updatePromises = activeSnapshot.docs.map(async (activeDoc) => {
      try {
        await updateDoc(doc(db, "streamSessions", activeDoc.id), {
          isActive: false,
          endedAt: new Date(),
        })
      } catch (error) {
        console.error(`Failed to end stream ${activeDoc.id}:`, error)
      }
    })
    
    await Promise.all(updatePromises)
    return { success: true, endedCount: activeSnapshot.docs.length }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
