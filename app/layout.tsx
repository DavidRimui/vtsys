import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { VercelAnalytics } from "@/components/analytics"
import { Providers } from "./providers"
const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Voting System",
  description: "A Next.js voting system with direct payment functionality",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <Providers>
              <Header />
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
              <Toaster />
              <VercelAnalytics />
            </Providers>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
