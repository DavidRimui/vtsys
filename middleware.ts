import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from './lib/auth-utils';

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/admin/dashboard',
  '/admin/candidates',
  '/admin/settings',
];

/**
 * Routes that should redirect to dashboard if already authenticated
 */
const AUTH_ROUTES = [
  '/admin/login',
  '/login',
  '/signup',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get auth token from cookies
  const token = request.cookies.get(process.env.SESSION_COOKIE_NAME || 'voting_session')?.value;
  const isAuthenticated = token && verifyAuthToken(token);
  
  // Check if accessing a protected route
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      const url = new URL('/admin/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Check if accessing auth routes while already authenticated
  if (isAuthenticated && AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  
  // Add CSRF protection header for all POST, PUT, DELETE requests
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    // Verify CSRF token in request headers (X-CSRF-Token) if needed
    // For this example, we're not implementing full CSRF protection
    // but in production you should verify the token here
  }
  
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/login',
    '/signup',
  ],
};
