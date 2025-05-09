import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, generateAuthToken } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { email, password } = await request.json();

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // HARDCODED ADMIN CREDENTIALS FOR DIRECT AUTHENTICATION
    // In production, you would normally use the database approach below this
    const ADMIN_EMAIL = 'agamirashadrack7@gmail.com';
    const ADMIN_PASSWORD = 'Shazrivas2025!';
    
    // Allow direct login with hardcoded credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Create a mock admin user with the email
      const adminUser = {
        id: 'admin-user-1',
        email: ADMIN_EMAIL,
        name: 'Admin User',
        password: 'hashed-password-not-used'
      };
      
      // Generate token for this admin
      const token = generateAuthToken(adminUser);
      
      // Set cookie in the response
      const cookieName = process.env.SESSION_COOKIE_NAME || 'voting_session';
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name
        }
      });
      
      // Set the cookie in the response
      response.cookies.set({
        name: cookieName,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      return response;
    }
    
    // Database fallback - find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    // Check if admin exists and password is correct
    if (!admin || !(await comparePassword(password, admin.password))) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateAuthToken(admin);

    // Prepare admin data (excluding password)
    const { password: _, ...adminData } = admin;
    
    // Set cookie in the response
    const cookieName = process.env.SESSION_COOKIE_NAME || 'voting_session';
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      admin: adminData
    });
    
    // Set the cookie in the response
    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'strict'
    });

    // Return the response
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
