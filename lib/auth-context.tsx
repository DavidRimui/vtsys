"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

type Admin = {
  id: string
  name: string
  email: string
}

type AuthContextType = {
  admin: Admin | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  isLoading: boolean
  refreshAuth: () => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Function to check current authentication status from the server
  const refreshAuth = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Important for cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.admin) {
          setAdmin(data.admin)
        } else {
          setAdmin(null)
        }
      } else {
        // If unauthorized or any error, clear the admin state
        setAdmin(null)
      }
    } catch (error) {
      console.error('Error refreshing auth:', error)
      setAdmin(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Check authentication status when the component mounts
  useEffect(() => {
    refreshAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Login function - calls the API to authenticate
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include', // Important for cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAdmin(data.admin)
        setIsLoading(false)
        return true
      } else {
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      return false
    }
  }

  // Logout function - calls the API to clear the session cookie
  const logout = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setAdmin(null)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Admin signup function - this is optional and only used in the signup form
  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Since we don't have a real signup endpoint in this app, we're just creating a stub
      // In a real app, you would send these details to your signup API endpoint
      console.log('Signup requested for:', { name, email });
      
      // Return true indicating success (this is just a stub)
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        login,
        logout,
        isLoading,
        refreshAuth,
        signup
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
