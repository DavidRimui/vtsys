import { PrismaClient } from "@prisma/client"
import { generateCandidates } from "../lib/data"

const prisma = new PrismaClient()

async function main() {
  try {
    // Check if candidates already exist
    const existingCandidatesCount = await prisma.candidate.count()

    if (existingCandidatesCount > 0) {
      console.log("Database already has candidates. Skipping initialization.")
      return
    }

    // Generate candidates
    const candidates = generateCandidates()

    // Insert candidates in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      await prisma.candidate.createMany({
        data: batch,
        skipDuplicates: true,
      })
      console.log(`Inserted batch ${i / batchSize + 1} of ${Math.ceil(candidates.length / batchSize)}`)
    }

    // Create default admin user
    await prisma.admin.create({
      data: {
        email: "admin@example.com",
        password: "password", // This should be hashed in a real app
        name: "Admin User",
      },
    })

    console.log("Database initialized successfully!")
  } catch (error) {
    console.error("Error initializing database:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
