import { db } from "./firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, setDoc } from "firebase/firestore"
import { type UserRole } from "./auth"

export interface StreamPermission {
  id?: string
  subscriberId: string
  publisherId: string
  allowVideo: boolean
  allowAudio: boolean
  createdAt: Date
  isActive: boolean
}

export interface StreamSession {
  id?: string
  publisherId: string
  publisherName: string
  roomId: string
  isActive: boolean
  createdAt: Date
  endedAt?: Date
}

export const createUser = async (email: string, password: string, role: UserRole, displayName?: string) => {
  try {
    // Create user ONLY in Firestore database (not in Firebase Auth yet)
    // They will be created in Auth when they log in for the first time
    
    // Check if user already exists in Firestore
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("email", "==", email))
    const existingUsers = await getDocs(q)
    
    if (!existingUsers.empty) {
      return { user: null, error: "A user with this email already exists" }
    }

    // Generate a unique ID for the pending user
    const pendingUserId = `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // Create user profile in Firestore with pending status
    const userProfile = {
      uid: pendingUserId, // Temporary ID until they log in
      email: email.toLowerCase(),
      role,
      displayName: displayName || email.split("@")[0],
      createdAt: new Date(),
      isActive: true,
      isPending: true, // Flag indicating they need to log in to activate
      pendingPassword: password, // Store password temporarily (will be removed on first login)
    }

    await setDoc(doc(db, "users", pendingUserId), userProfile)

    return { 
      user: { uid: pendingUserId, email } as any, 
      error: null,
      message: "User created successfully. They can now log in with their credentials."
    }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, "users")
    const q = query(usersRef, orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error("Error fetching users:", error)
    return []
  }
}

export const getUsersByRole = async (role: UserRole) => {
  try {
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("role", "==", role))
    const querySnapshot = await getDocs(q)

    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Sort by createdAt in memory to avoid composite index
    return users.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error fetching users by role:", error)
    return []
  }
}

export const updateUserStatus = async (userId: string, isActive: boolean, adminEmail?: string, adminId?: string) => {
  try {
    const userRef = doc(db, "users", userId)
    const updateData: any = { isActive }
    
    // If deactivating, track who did it and when
    if (!isActive) {
      updateData.deactivatedBy = adminEmail || "Admin"
      updateData.deactivatedById = adminId || null
      updateData.deactivatedAt = new Date()
    } else {
      // If reactivating, clear the deactivation data
      updateData.deactivatedBy = null
      updateData.deactivatedById = null
      updateData.deactivatedAt = null
    }
    
    await updateDoc(userRef, updateData)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const updatePublisherZoomMapping = async (userId: string, updates: { zoomUserId?: string; zoomUserEmail?: string }) => {
  try {
    const userRef = doc(db, "users", userId)
    await updateDoc(userRef, updates as any)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const createStreamPermission = async (permission: Omit<StreamPermission, "id" | "createdAt">) => {
  try {
    const permissionData = {
      ...permission,
      createdAt: new Date(),
    }

    const docRef = await addDoc(collection(db, "streamPermissions"), permissionData)
    return { success: true, id: docRef.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const getStreamPermissions = async () => {
  try {
    const permissionsRef = collection(db, "streamPermissions")
    const q = query(permissionsRef)
    const querySnapshot = await getDocs(q)

    const permissions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StreamPermission[]

    // Sort by createdAt in memory to avoid composite index
    return permissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error fetching stream permissions:", error)
    return []
  }
}

export const updateStreamPermission = async (permissionId: string, updates: Partial<StreamPermission>) => {
  try {
    const permissionRef = doc(db, "streamPermissions", permissionId)
    await updateDoc(permissionRef, updates)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const deleteStreamPermission = async (permissionId: string) => {
  try {
    await deleteDoc(doc(db, "streamPermissions", permissionId))
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
