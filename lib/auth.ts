import { auth, db } from "./firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"

export type UserRole = "admin" | "publisher" | "subscriber"

export interface UserProfile {
  uid: string
  email: string
  role: UserRole
  displayName?: string
  createdAt: Date
  isActive: boolean
  currentSessionId?: string // For single device login enforcement
  lastLoginAt?: Date
}

// Generate a unique session ID
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

export const signIn = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    
    // Generate a new session ID and store it in the user profile
    const sessionId = generateSessionId()
    const userRef = doc(db, "users", result.user.uid)
    
    // Get user profile to check role
    const userDoc = await getDoc(userRef)
    const userData = userDoc.data() as UserProfile
    
    // Only enforce single session for subscribers
    if (userData?.role === "subscriber") {
      await updateDoc(userRef, {
        currentSessionId: sessionId,
        lastLoginAt: new Date(),
      })
      
      // Store session ID in localStorage to track this session
      if (typeof window !== "undefined") {
        localStorage.setItem(`session_${result.user.uid}`, sessionId)
      }
    }
    
    return { user: result.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const signUp = async (email: string, password: string, role: UserRole, displayName?: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)

    // Create user profile in Firestore
    const userProfile: UserProfile = {
      uid: result.user.uid,
      email: result.user.email!,
      role,
      displayName: displayName || email.split("@")[0],
      createdAt: new Date(),
      isActive: true,
    }

    await setDoc(doc(db, "users", result.user.uid), userProfile)

    return { user: result.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const signOut = async () => {
  try {
    // Clear session ID from localStorage
    if (typeof window !== "undefined" && auth.currentUser) {
      localStorage.removeItem(`session_${auth.currentUser.uid}`)
    }
    
    await firebaseSignOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

// Check if the current session is still valid (for single device login)
export const isSessionValid = async (uid: string): Promise<boolean> => {
  try {
    if (typeof window === "undefined") return true
    
    const userRef = doc(db, "users", uid)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) return false
    
    const userData = userDoc.data() as UserProfile
    
    // Only check session for subscribers
    if (userData.role !== "subscriber") return true
    
    const storedSessionId = localStorage.getItem(`session_${uid}`)
    const currentSessionId = userData.currentSessionId
    
    // If no session ID is set yet, consider it valid
    if (!currentSessionId) return true
    
    // Check if this device's session matches the stored session
    return storedSessionId === currentSessionId
  } catch (error) {
    console.error("Error checking session validity:", error)
    return true // Fail open to avoid locking users out
  }
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile
    }
    return null
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return null
  }
}

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}
