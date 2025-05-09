"use server"

import { prisma } from "@/lib/db"
import { getCandidates } from "@/lib/data"

// Initialize the database with candidates
export async function initializeDatabase() {
  const existingCandidatesCount = await prisma.candidate.count()

  if (existingCandidatesCount === 0) {
    const candidates = getCandidates()

    // Insert candidates in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      await prisma.candidate.createMany({
        data: batch,
        skipDuplicates: true,
      })
    }

    return { success: true, message: "Database initialized with candidates" }
  }

  return { success: true, message: "Database already initialized" }
}

// Get all candidates from the database
export async function getCandidatesFromDB() {
  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: {
        votes: "desc",
      },
    })

    return { success: true, candidates }
  } catch (error) {
    console.error("Error fetching candidates:", error)
    return { success: false, error: "Failed to fetch candidates" }
  }
}

// Vote for a candidate
export async function voteForCandidateInDB(candidateId: string) {
  try {
    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        votes: {
          increment: 1,
        },
      },
    })

    return { success: true, candidate }
  } catch (error) {
    console.error("Error voting for candidate:", error)
    return { success: false, error: "Failed to vote for candidate" }
  }
}

// Create an admin user
export async function createAdminUser(email: string, password: string, name: string) {
  try {
    // In a real app, you would hash the password
    const admin = await prisma.admin.create({
      data: {
        email,
        password, // This should be hashed in a real app
        name,
      },
    })

    return { success: true, admin }
  } catch (error) {
    console.error("Error creating admin user:", error)
    return { success: false, error: "Failed to create admin user" }
  }
}

// Verify admin credentials
export async function verifyAdminCredentials(email: string, password: string) {
  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
    })

    if (!admin) {
      return { success: false, error: "Admin not found" }
    }

    // In a real app, you would compare hashed passwords
    if (admin.password !== password) {
      return { success: false, error: "Invalid password" }
    }

    return { success: true, admin: { id: admin.id, email: admin.email, name: admin.name } }
  } catch (error) {
    console.error("Error verifying admin credentials:", error)
    return { success: false, error: "Failed to verify admin credentials" }
  }
}
