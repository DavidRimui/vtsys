import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Input validation schema
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Validation error', 
        errors: result.error.format() 
      }, { status: 400 });
    }
    
    const { email, password, name } = result.data;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'User with this email already exists' 
      }, { status: 409 });
    }
    
    // Hash the password
    const hashedPassword = await hash(password, 10);
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      }
    });
    
    // Return success without exposing the user object
    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully',
      userId: user.id
    }, { status: 201 });
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'An error occurred during signup' 
    }, { status: 500 });
  }
}
