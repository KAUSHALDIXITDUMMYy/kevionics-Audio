import { db } from "./firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore"
import { signUp, type UserRole } from "./auth"

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
    const result = await signUp(email, password, role, displayName)
    return result
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

export const updateUserStatus = async (userId: string, isActive: boolean) => {
  try {
    const userRef = doc(db, "users", userId)
    await updateDoc(userRef, { isActive })
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
