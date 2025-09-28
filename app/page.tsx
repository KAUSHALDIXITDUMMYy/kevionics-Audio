import { LoginForm } from "@/components/auth/login-form"

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Kevonics Audio</h1>
          <p className="text-muted-foreground">Professional Screen Sharing Management System</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
