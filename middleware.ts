import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Simple middleware that only handles CSRF protection if needed
  // Since we've removed authentication, we don't need route protection
  
  // You could add rate limiting or other protections here if needed
  
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
