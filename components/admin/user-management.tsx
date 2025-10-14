"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createUser, getAllUsers, updateUserStatus } from "@/lib/admin"
import type { UserProfile, UserRole } from "@/lib/auth"
import { Plus, Users, UserCheck, UserX, Shield, Video, Eye, UserMinus } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, onSnapshot } from "firebase/firestore"
import { useAuth } from "@/hooks/use-auth"

// Utility function to convert Firestore Timestamp to Date
const convertTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp
  }
  
  // If it's a Firestore Timestamp with toDate method
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  
  // If it's a Firestore Timestamp object with seconds and nanoseconds
  if (timestamp && typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000)
  }
  
  // Try to parse as string or number
  try {
    const date = new Date(timestamp)
    if (!isNaN(date.getTime())) {
      return date
    }
  } catch (e) {
    console.error('Error converting timestamp:', timestamp, e)
  }
  
  return null
}

// Utility function to sort users alphabetically
const sortUsersAlphabetically = (users: (UserProfile & { id: string })[]) => {
  return [...users].sort((a, b) => {
    const nameA = (a.displayName || a.email).toLowerCase()
    const nameB = (b.displayName || b.email).toLowerCase()
    return nameA.localeCompare(nameB)
  })
}

export function UserManagement() {
  const { userProfile } = useAuth()
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Create user form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("subscriber")
  const [displayName, setDisplayName] = useState("")

  useEffect(() => {
    loadUsers()
    
    // Set up real-time listener for users
    const usersRef = collection(db, "users")
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamps to JS Date objects
          createdAt: convertTimestampToDate(data.createdAt) || new Date(),
          lastLoginAt: convertTimestampToDate(data.lastLoginAt) || undefined,
        }
      }) as (UserProfile & { id: string })[]
      
      // Sort by createdAt
      const sorted = usersData.sort((a: any, b: any) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
        return dateB.getTime() - dateA.getTime()
      })
      
      setUsers(sorted)
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    const usersData = await getAllUsers()
    setUsers(usersData as (UserProfile & { id: string })[])
    setLoading(false)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    setError("")
    setSuccess("")

    const result = await createUser(email, password, role, displayName)

    if (result.error) {
      setError(result.error)
    } else if (result.user) {
      setSuccess(`User created successfully! ${email} can now log in with their credentials.`)
      setEmail("")
      setPassword("")
      setDisplayName("")
      setRole("subscriber")
      setShowCreateForm(false)
      loadUsers()
    }

    setCreateLoading(false)
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const adminEmail = userProfile?.email || "Unknown Admin"
    const adminId = userProfile?.uid || undefined
    const result = await updateUserStatus(userId, !currentStatus, adminEmail, adminId)
    if (result.success) {
      loadUsers()
    } else {
      setError(result.error || "Failed to update user status")
    }
  }

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "publisher":
        return "default"
      case "subscriber":
        return "secondary"
      default:
        return "outline"
    }
  }

  // Separate and sort users by role and status
  const usersByRole = useMemo(() => {
    const admins = sortUsersAlphabetically(users.filter((u) => u.role === "admin"))
    const publishers = sortUsersAlphabetically(users.filter((u) => u.role === "publisher"))
    const subscribers = sortUsersAlphabetically(users.filter((u) => u.role === "subscriber"))
    const inactive = sortUsersAlphabetically(users.filter((u) => !u.isActive && !(u as any).isPending))
    return { admins, publishers, subscribers, inactive }
  }, [users])

  const getStats = () => {
    const total = users.length
    const active = users.filter((u) => u.isActive).length
    const inactive = users.filter((u) => !u.isActive && !(u as any).isPending).length
    const byRole = users.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      },
      {} as Record<UserRole, number>,
    )

    return { total, active, inactive, byRole }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Inactive Users</p>
                <p className="text-2xl font-bold">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-medium">Publishers</p>
              <p className="text-2xl font-bold">{stats.byRole.publisher || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-medium">Subscribers</p>
              <p className="text-2xl font-bold">{stats.byRole.subscriber || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Create and manage user accounts for Kevonics Screen Share</CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </CardHeader>

        {showCreateForm && (
          <CardContent className="border-t">
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-md">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="publisher">Publisher</SelectItem>
                      <SelectItem value="subscriber">Subscriber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create User"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Users Table with Tabs by Role */}
      <Card>
        <CardHeader>
          <CardTitle>Users by Role</CardTitle>
          <CardDescription>View and manage users organized by their roles (sorted alphabetically)</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                All Users ({users.length})
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admins ({usersByRole.admins.length})
              </TabsTrigger>
              <TabsTrigger value="publishers" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Publishers ({usersByRole.publishers.length})
              </TabsTrigger>
              <TabsTrigger value="subscribers" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Subscribers ({usersByRole.subscribers.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="flex items-center gap-2">
                <UserMinus className="h-4 w-4" />
                Inactive Users ({usersByRole.inactive.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <UserTable users={sortUsersAlphabetically(users)} onToggleStatus={handleToggleUserStatus} getRoleBadgeVariant={getRoleBadgeVariant} />
            </TabsContent>

            <TabsContent value="admins">
              {usersByRole.admins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No admins found</div>
              ) : (
                <UserTable users={usersByRole.admins} onToggleStatus={handleToggleUserStatus} getRoleBadgeVariant={getRoleBadgeVariant} />
              )}
            </TabsContent>

            <TabsContent value="publishers">
              {usersByRole.publishers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No publishers found</div>
              ) : (
                <UserTable users={usersByRole.publishers} onToggleStatus={handleToggleUserStatus} getRoleBadgeVariant={getRoleBadgeVariant} />
              )}
            </TabsContent>

            <TabsContent value="subscribers">
              {usersByRole.subscribers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No subscribers found</div>
              ) : (
                <UserTable users={usersByRole.subscribers} onToggleStatus={handleToggleUserStatus} getRoleBadgeVariant={getRoleBadgeVariant} />
              )}
            </TabsContent>

            <TabsContent value="inactive">
              {usersByRole.inactive.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
                  <p>No inactive users - all users are active!</p>
                </div>
              ) : (
                <UserTable users={usersByRole.inactive} onToggleStatus={handleToggleUserStatus} getRoleBadgeVariant={getRoleBadgeVariant} showInactiveHighlight={true} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Reusable User Table Component
function UserTable({
  users,
  onToggleStatus,
  getRoleBadgeVariant,
  showInactiveHighlight = false,
}: {
  users: (UserProfile & { id: string })[]
  onToggleStatus: (userId: string, currentStatus: boolean) => void
  getRoleBadgeVariant: (role: UserRole) => any
  showInactiveHighlight?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Display Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deactivated By</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow 
            key={user.id}
            className={showInactiveHighlight && !user.isActive ? "bg-red-50 dark:bg-red-950/20" : ""}
          >
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {user.email}
                {(user as any).isPending && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Pending First Login
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>{user.displayName || "-"}</TableCell>
            <TableCell>
              <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                {(user as any).isPending ? (
                  <>
                    <div className="h-4 w-4 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-yellow-600">Pending Login</span>
                  </>
                ) : user.isActive ? (
                  <>
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Active</span>
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4 text-red-600" />
                    <span className="text-red-600">Inactive</span>
                  </>
                )}
              </div>
            </TableCell>
            <TableCell>
              {!user.isActive && user.deactivatedBy ? (
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.deactivatedBy}</span>
                  {user.deactivatedAt && (() => {
                    const date = convertTimestampToDate(user.deactivatedAt)
                    if (!date) return null
                    try {
                      return (
                        <span className="text-xs text-muted-foreground">
                          {date.toLocaleDateString()} {date.toLocaleTimeString()}
                        </span>
                      )
                    } catch (e) {
                      return null
                    }
                  })()}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </TableCell>
            <TableCell>
              {(() => {
                const date = convertTimestampToDate(user.createdAt)
                if (!date) return "-"
                try {
                  return (
                    <div className="flex flex-col">
                      <span className="font-medium">{date.toLocaleDateString()}</span>
                      <span className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</span>
                    </div>
                  )
                } catch (e) {
                  return "-"
                }
              })()}
            </TableCell>
            <TableCell>
              {(user as any).isPending ? (
                <span className="text-xs text-muted-foreground">
                  Waiting for first login
                </span>
              ) : (
                <Switch
                  checked={user.isActive}
                  onCheckedChange={() => onToggleStatus(user.id, user.isActive)}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

