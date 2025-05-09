"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, User, Vote } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header() {
  const { admin, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    router.push("/voting")
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/voting" className="text-xl font-bold flex items-center gap-2">
          <Vote className="h-6 w-6" />
          <span>VoteSystem</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {admin ? (
            <Link href="/admin/dashboard" className={`text-sm ${pathname === "/admin/dashboard" ? "font-bold" : ""}`}>
              Admin Dashboard
            </Link>
          ) : (
            <>
              <Link href="/voting" className={`text-sm ${pathname === "/voting" ? "font-bold" : ""}`}>
                Vote Now
              </Link>
              <Link href="/admin/login" className={`text-sm ${pathname === "/admin/login" ? "font-bold" : ""}`}>
                Admin Login
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {admin && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary text-primary-foreground rounded-full p-1">
                  <User className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium hidden md:inline-block">{admin.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden md:inline-block">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
