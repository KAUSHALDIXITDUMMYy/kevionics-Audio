"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChange, getUserProfile, isSessionValid, signOut, type UserProfile } from "@/lib/auth"
import { toast } from "sonner"

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user)

      if (user) {
        const profile = await getUserProfile(user.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Check session validity periodically for subscribers
  useEffect(() => {
    if (!user || !userProfile) return
    
    // Only check for subscribers
    if (userProfile.role !== "subscriber") return

    const checkSession = async () => {
      const valid = await isSessionValid(user.uid)
      
      if (!valid) {
        console.log("[Session] Invalid session detected - logging out...")
        
        // Show toast notification
        toast.error("Logged out from another device", {
          description: "Your account has been logged in from another device. You have been signed out from this session.",
          duration: 5000,
        })
        
        // Sign out after a brief delay to show the toast
        setTimeout(async () => {
          await signOut()
          if (typeof window !== "undefined") {
            window.location.href = "/"
          }
        }, 1500)
      }
    }

    // Check immediately
    checkSession()

    // Then check every 10 seconds
    const interval = setInterval(checkSession, 10000)

    return () => clearInterval(interval)
  }, [user, userProfile])

  return <AuthContext.Provider value={{ user, userProfile, loading }}>{children}</AuthContext.Provider>
}
