"use client"

import { useEffect, useState } from "react"
import { type Candidate, getCandidates } from "@/lib/data"

// Polling interval in milliseconds
const POLLING_INTERVAL = 5000

export function useRealTimeVotes() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initial load
  useEffect(() => {
    const fetchCandidates = () => {
      const allCandidates = getCandidates()
      setCandidates(allCandidates)
      setIsLoading(false)
    }

    fetchCandidates()
  }, [])

  // Set up polling for real-time updates
  useEffect(() => {
    if (isLoading) return

    const intervalId = setInterval(() => {
      const updatedCandidates = getCandidates()
      setCandidates([...updatedCandidates])
    }, POLLING_INTERVAL)

    return () => clearInterval(intervalId)
  }, [isLoading])

  return { candidates, isLoading }
}
