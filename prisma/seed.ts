import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Seed candidates if your schema includes a Candidate model
    // This is simplified since authentication is removed
    
    // You can add candidate seeding here if needed. Example:
    // await prisma.candidate.createMany({
    //   data: [
    //     { name: 'Candidate 1', category: 'category1', description: 'Description 1', votes: 0 },
    //     { name: 'Candidate 2', category: 'category2', description: 'Description 2', votes: 0 },
    //   ],
    //   skipDuplicates: true,
    // });
    
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
