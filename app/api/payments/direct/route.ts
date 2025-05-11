import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment-service';

export async function POST(request: NextRequest) {
  try {
    // For demo purposes, we're not requiring authentication
    // In a production app, you would want to validate the session

    // Get the payment data from the request body
    const paymentData = await request.json();
    
    // Process the payment using our PaymentService
    const result = await PaymentService.processDirectPayment(paymentData);
    
    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { status: false, message: 'An unexpected error occurred during payment processing' },
      { status: 500 }
    );
  }
}
