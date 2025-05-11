import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Health check endpoint for monitoring
 * Returns basic application health status and uptime
 */
export async function GET() {
  try {
    // Check database connection
    const databaseStatus = await checkDatabase();
    
    // Get application uptime
    const uptime = process.uptime();
    
    // Basic system information
    const memoryUsage = process.memoryUsage();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(uptime),
      environment: process.env.NODE_ENV,
      database: databaseStatus,
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'production' ? 'Service unavailable' : error
      },
      { status: 503 }
    );
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase() {
  try {
    // Simple query to check database connection
    const result = await prisma.$queryRaw`SELECT 1 as health`;
    return { connected: true };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { 
      connected: false,
      error: process.env.NODE_ENV === 'production' ? 'Database connection issue' : error
    };
  }
}

/**
 * Format uptime into human-readable format
 */
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
