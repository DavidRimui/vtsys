"use client"

import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Vote } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header() {
  // Get isTestMode from our simplified context
  const { isTestMode } = useAuth()
  const pathname = usePathname()

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/voting" className="text-xl font-bold flex items-center gap-2">
          <Vote className="h-6 w-6" />
          <span>VoteSystem</span>
          {isTestMode && <span className="text-xs text-muted-foreground ml-2">(Test Mode)</span>}
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
