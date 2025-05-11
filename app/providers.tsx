"use client"

import React from "react"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

export function NextAuthProvider({
  children,
  session = null,
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  return (
    <SessionProvider session={session} refetchInterval={5 * 60}>
      {children}
    </SessionProvider>
  )
}
