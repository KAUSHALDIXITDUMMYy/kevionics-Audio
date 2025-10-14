import { auth, db } from "./firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore"

export type UserRole = "admin" | "publisher" | "subscriber"

export interface UserProfile {
  uid: string
  email: string
  role: UserRole
  displayName?: string
  zoomUserId?: string
  zoomUserEmail?: string
  createdAt: Date
  isActive: boolean
  sessionId?: string // For single-session enforcement
  lastLoginAt?: Date
  isPending?: boolean // Flag for users created by admin but not yet logged in
  pendingPassword?: string // Temporary password storage for pending users
  deactivatedBy?: string | null // Email of admin who deactivated the user
  deactivatedById?: string | null // UID of admin who deactivated the user
  deactivatedAt?: Date | null // Timestamp when user was deactivated
}

export const signIn = async (email: string, password: string) => {
  try {
    // First, check if user exists in Firestore as a pending user
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("email", "==", email.toLowerCase()))
    const querySnapshot = await getDocs(q)
    
    // Check for pending user
    if (!querySnapshot.empty) {
      const pendingUserDoc = querySnapshot.docs[0]
      const pendingUserData = pendingUserDoc.data() as any
      
      if (pendingUserData.isPending && pendingUserData.pendingPassword === password) {
        // This is a pending user logging in for the first time
        // Create them in Firebase Auth
        const authResult = await createUserWithEmailAndPassword(auth, email, password)
        
        const oldPendingId = pendingUserDoc.id
        const newAuthUid = authResult.user.uid
        
        // Migrate all stream permissions from pending ID to real UID
        const permissionsRef = collection(db, "streamPermissions")
        const permissionsQuery = query(permissionsRef, where("subscriberId", "==", oldPendingId))
        const permissionsSnapshot = await getDocs(permissionsQuery)
        
        // Update all permissions with new UID
        const permissionUpdates: Promise<void>[] = []
        permissionsSnapshot.docs.forEach((permDoc) => {
          permissionUpdates.push(
            updateDoc(doc(db, "streamPermissions", permDoc.id), {
              subscriberId: newAuthUid,
            })
          )
        })
        
        // Also migrate zoom assignments if any
        const zoomAssignmentsRef = collection(db, "zoomPublisherAssignments")
        const zoomQuery = query(zoomAssignmentsRef, where("subscriberId", "==", oldPendingId))
        const zoomSnapshot = await getDocs(zoomQuery)
        
        zoomSnapshot.docs.forEach((zoomDoc) => {
          permissionUpdates.push(
            updateDoc(doc(db, "zoomPublisherAssignments", zoomDoc.id), {
              subscriberId: newAuthUid,
            })
          )
        })
        
        // Wait for all migrations to complete
        await Promise.all(permissionUpdates)
        
        // Update Firestore profile with real UID and remove pending flags
        const userProfile = {
          uid: newAuthUid,
          email: authResult.user.email!,
          role: pendingUserData.role,
          displayName: pendingUserData.displayName,
          createdAt: pendingUserData.createdAt,
          isActive: pendingUserData.isActive,
          // Remove pending fields
          isPending: false,
          pendingPassword: null,
        }
        
        // Create new document with real UID FIRST
        await setDoc(doc(db, "users", newAuthUid), userProfile)
        
        // For subscribers, implement single-session enforcement
        if (pendingUserData.role === "subscriber") {
          const sessionId = crypto.randomUUID()
          const userRef = doc(db, "users", newAuthUid)
          
          await updateDoc(userRef, {
            sessionId,
            lastLoginAt: new Date(),
          })
          
          // Store sessionId in localStorage for this session
          if (typeof window !== "undefined") {
            localStorage.setItem("sessionId", sessionId)
          }
        }
        
        // Delete old pending document AFTER everything is set up
        await deleteDoc(doc(db, "users", oldPendingId))
        
        // Small delay to ensure Firestore is fully synced
        await new Promise(resolve => setTimeout(resolve, 500))
        
        return { user: authResult.user, error: null }
      }
    }
    
    // Not a pending user, try normal sign in
    const result = await signInWithEmailAndPassword(auth, email, password)
    
    // Get user profile to check role
    const userProfile = await getUserProfile(result.user.uid)
    
    // For subscribers, implement single-session enforcement
    if (userProfile && userProfile.role === "subscriber") {
      const sessionId = crypto.randomUUID()
      const userRef = doc(db, "users", result.user.uid)
      
      await updateDoc(userRef, {
        sessionId,
        lastLoginAt: new Date(),
      })
      
      // Store sessionId in localStorage for this session
      if (typeof window !== "undefined") {
        localStorage.setItem("sessionId", sessionId)
      }
    }
    
    return { user: result.user, error: null }
  } catch (error: any) {
    // If sign in fails, check if it's a pending user with wrong password
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
    const currentUser = auth.currentUser
    
    // Clear session ID from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("sessionId")
    }
    
    // Clear session ID from Firestore for subscribers
    if (currentUser) {
      const userProfile = await getUserProfile(currentUser.uid)
      if (userProfile && userProfile.role === "subscriber") {
        const userRef = doc(db, "users", currentUser.uid)
        await updateDoc(userRef, {
          sessionId: null,
        })
      }
    }
    
    await firebaseSignOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

export const getUserProfile = async (uid: string, retryCount = 0): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile
      // Convert Firestore timestamps to Date objects
      return {
        ...data,
        createdAt: data.createdAt instanceof Date ? data.createdAt : (data.createdAt as any)?.toDate?.() || new Date(),
        lastLoginAt: data.lastLoginAt instanceof Date ? data.lastLoginAt : (data.lastLoginAt as any)?.toDate?.() || undefined,
      }
    }
    
    // If document doesn't exist and this is a fresh login, retry a few times
    // (to handle pending user migration race condition)
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return getUserProfile(uid, retryCount + 1)
    }
    
    return null
  } catch (error) {
    console.error("Error fetching user profile:", error)
    
    // Retry on error as well
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return getUserProfile(uid, retryCount + 1)
    }
    
    return null
  }
}

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}
