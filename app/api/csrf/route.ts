import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/auth-utils';

/**
 * API endpoint to generate and provide CSRF tokens to the client
 * This is used to protect against Cross-Site Request Forgery attacks
 */
export async function GET(request: NextRequest) {
  try {
    // Generate a new CSRF token
    const csrfToken = generateCSRFToken();
    
    // Create a response with minimal information
    const response = NextResponse.json({ status: true });
    
    // Add the CSRF token to the response headers
    response.headers.set('X-CSRF-Token', csrfToken);
    
    return response;
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json(
      { status: false, message: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
