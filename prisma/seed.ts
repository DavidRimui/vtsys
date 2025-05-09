import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-utils';

const prisma = new PrismaClient();

async function main() {
  try {
    // Admin credentials
    const email = 'agamirashadrack7@gmail.com';
    const password = 'Shazrivas2025!';
    
    // Hash the password for security
    const hashedPassword = await hashPassword(password);
    
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    });
    
    if (existingAdmin) {
      // Update existing admin
      const updatedAdmin = await prisma.admin.update({
        where: { email },
        data: {
          password: hashedPassword,
          name: 'Admin User'
        }
      });
      console.log(`Updated admin: ${updatedAdmin.email}`);
    } else {
      // Create new admin if doesn't exist
      const newAdmin = await prisma.admin.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Admin User'
        }
      });
      console.log(`Created new admin: ${newAdmin.email}`);
    }
    
    console.log('Admin seed completed successfully');
  } catch (error) {
    console.error('Error seeding admin:', error);
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
