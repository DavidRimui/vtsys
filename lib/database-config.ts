/**
 * Database configuration with environment-specific settings
 * 
 * This provides different database connection strings for:
 * - Development: Uses local PostgreSQL database
 * - Production: Uses Vercel Postgres or other cloud provider
 * - Testing: Uses a separate database for automated tests
 */

// Default to localhost for development
const defaultConnectionString = "postgresql://user:password@localhost:5432/vtsys";

// Get the appropriate database URL based on environment
export function getDatabaseUrl(): string {
  // Use POSTGRES_URL in production (set by Vercel Postgres)
  // Or DATABASE_URL as fallback (for other PostgreSQL providers)
  if (process.env.NODE_ENV === 'production') {
    // Order of preference: 
    // 1. POSTGRES_URL (Vercel Postgres)
    // 2. DATABASE_URL (Other providers)
    // 3. Default connection (should never happen in production)
    const productionUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!productionUrl) {
      console.warn('WARNING: No production database URL found. Using default connection string.');
      return defaultConnectionString;
    }
    
    return productionUrl;
  }
  
  // For test environment
  if (process.env.NODE_ENV === 'test') {
    return process.env.TEST_DATABASE_URL || defaultConnectionString;
  }
  
  // Development environment - use local database
  return process.env.DATABASE_URL || defaultConnectionString;
}
