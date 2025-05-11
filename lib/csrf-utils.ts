import crypto from 'crypto';

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Simple verification - in a real auth system this would validate against a stored token
 * but for our authentication-free system, we'll just ensure it's a valid format
 */
export function verifyCSRFToken(token: string): boolean {
  // Verify token is 64 characters hex string (32 bytes as hex)
  return /^[a-f0-9]{64}$/.test(token);
}
