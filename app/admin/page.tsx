"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { UserManagement } from "@/components/admin/user-management"
import { StreamPermissions } from "@/components/admin/stream-permissions"
import { RealTimePermissions } from "@/components/admin/real-time-permissions"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signOut } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Settings, Users, Shield, LogOut, Activity } from "lucide-react"
import { SubscriberAssignments } from "@/components/admin/subscriber-assignments"
import { ZoomAssignmentsAdmin } from "@/components/admin/zoom-assignments"

export default function AdminDashboard() {
  const { userProfile } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Settings className="h-6 w-6" />
                <div>
                  <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                  <p className="text-muted-foreground">
                    Welcome back, {userProfile?.displayName || userProfile?.email}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="users" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>User Management</span>
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Stream Permissions</span>
              </TabsTrigger>
              <TabsTrigger value="monitor" className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Live Monitor</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Assignments</span>
              </TabsTrigger>
              <TabsTrigger value="zoom-calls" className="flex items-center space-x-2">
                <span>Zoom Assignments</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="permissions">
              <StreamPermissions />
            </TabsContent>

            <TabsContent value="monitor">
              <RealTimePermissions />
            </TabsContent>

            <TabsContent value="assignments">
              <SubscriberAssignments />
            </TabsContent>
            <TabsContent value="zoom-calls">
              <ZoomAssignmentsAdmin />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  )
}
