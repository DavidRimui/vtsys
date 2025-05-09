// @ts-check
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupAdmin() {
  try {
    // Admin credentials
    const email = 'agamirashadrack7@gmail.com';
    const password = 'Shazrivas2025!';
    
    // Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);
    
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
    
    console.log('Admin setup completed successfully');
  } catch (error) {
    console.error('Error setting up admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
