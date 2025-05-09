import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, verifyCSRFToken } from './auth-utils';

/**
 * Middleware to check for CSRF token in sensitive requests
 */
export function csrfProtection(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    // Only apply CSRF check to mutating methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // Get CSRF token from header
      const csrfToken = req.headers.get('X-CSRF-Token');
      
      // In production, verify the token
      if (process.env.NODE_ENV === 'production') {
        if (!csrfToken || !verifyCSRFToken(csrfToken)) {
          return NextResponse.json(
            { success: false, message: 'Invalid or missing CSRF token' },
            { status: 403 }
          );
        }
      }
    }
    
    // If CSRF check passes, continue to the handler
    return handler(req);
  };
}

/**
 * Generate a new CSRF token for client use
 */
export function generateNewCSRFToken(): string {
  return generateCSRFToken();
}

/**
 * Add CSRF token to response headers
 */
export function addCSRFTokenToResponse(response: NextResponse): NextResponse {
  const csrfToken = generateNewCSRFToken();
  response.headers.set('X-CSRF-Token', csrfToken);
  return response;
}
