"use client"

import type React from "react"
import { createContext, useContext, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

// Define a simpler Admin type for the context
type Admin = {
  id: string
  name?: string | null
  email: string
}

// Define the simplified AuthContext type without NextAuth dependencies
type AuthContextType = {
  admin: Admin | null
  isTestMode: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Simplified state - just whether an admin exists and loading state
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Test mode flag for development
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true' || 
                     process.env.NODE_ENV !== 'production';

  // Provide minimal context values
  return (
    <AuthContext.Provider
      value={{
        admin,
        isTestMode,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
