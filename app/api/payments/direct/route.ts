import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment-service';

export async function POST(request: NextRequest) {
  try {
    // Get the payment data from the request body
    let paymentData;
    try {
      paymentData = await request.json();
      console.log('Received payment request payload:', JSON.stringify(paymentData, null, 2));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return NextResponse.json(
        { status: false, message: 'Invalid request format. Please provide valid JSON.' },
        { status: 400 }
      );
    }
    
    // Check for required fields
    if (!paymentData || !paymentData.phone_number || !paymentData.amount || !paymentData.kitty_id) {
      console.error('Missing required fields in payment data:', paymentData);
      return NextResponse.json(
        { 
          status: false, 
          message: 'Missing required fields in request', 
          requiredFields: ['phone_number', 'amount', 'kitty_id', 'channel_code']
        },
        { status: 400 }
      );
    }
    
    // Log environment variable availability for debugging
    console.log('Environment check for API Call:', {
      haveApiKey: !!process.env.ONE_KITTY_API_KEY,
      channel_codes: process.env.ONE_KITTY_CHANNEL_CODES || 'not set',
      apiHost: process.env.ONE_KITTY_API_HOST || 'not set',
      nodeEnv: process.env.NODE_ENV,
      baseUrl: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'not set'
    });
    
    // Add verification for payment test mode
    const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';
    if (isTestMode && process.env.NODE_ENV !== 'production') {
      console.log('Running in test mode - bypassing real payment processing');
      return NextResponse.json({
        status: true,
        message: 'Test payment initiated successfully',
        data: { transactionId: `test-${Date.now()}` }
      });
    }
    
    // Process the payment using our PaymentService
    const result = await PaymentService.processDirectPayment(paymentData);
    console.log('Payment service result:', JSON.stringify(result, null, 2));
    
    // Return the result
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Payment processing error:', error);
    // Provide more detailed error information
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = process.env.NODE_ENV !== 'production' ? error?.stack : undefined;
    
    return NextResponse.json(
      { 
        status: false, 
        message: `Payment processing error: ${errorMessage}`,
        details: process.env.NODE_ENV !== 'production' ? errorStack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
