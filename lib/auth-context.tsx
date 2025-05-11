"use client"

import type React from "react"
import { createContext, useContext, useState } from 'react';

// Define a minimal context type for app-wide settings only
type AppContextType = {
  isTestMode: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function useAuth() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Keep the name AuthProvider for backward compatibility
export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Test mode flag for development
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true' || 
                     process.env.NODE_ENV !== 'production';

  // Provide minimal context value
  return (
    <AppContext.Provider
      value={{
        isTestMode
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
