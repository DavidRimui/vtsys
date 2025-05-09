import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Define the Admin type based on Prisma's schema
type Admin = {
  id: string;
  email: string;
  password: string;
  name?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this_in_production';
const JWT_EXPIRY = '24h'; // Token expiration time
const SALT_ROUNDS = 10;  // For bcrypt password hashing

/**
 * Generate a JWT token for the admin user
 */
export function generateAuthToken(admin: Admin): string {
  // Remove sensitive data from the admin object
  const { password, ...adminData } = admin;
  
  return jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify a JWT token and return the admin data
 */
export function verifyAuthToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(): string {
  return jwt.sign({}, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}
