import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Get the token from cookie
    const token = request.cookies.get(process.env.SESSION_COOKIE_NAME || 'voting_session')?.value;
    
    // If no token exists, return unauthorized
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify the token
    const decodedToken = verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.id) {
      return NextResponse.json(
        { success: false, message: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get admin from database
    const admin = await prisma.admin.findUnique({
      where: { id: decodedToken.id }
    });

    // If admin doesn't exist, return unauthorized
    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    // Return admin data (excluding password)
    const { password: _, ...adminData } = admin;
    return NextResponse.json({
      success: true,
      message: 'Authenticated',
      admin: adminData
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
