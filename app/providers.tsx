"use client"

import React from "react"

// Simplified provider component without authentication
// You can add other providers here if needed in the future
export function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>{children}</>
  )
}
