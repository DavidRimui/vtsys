import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { csrfProtection, addCSRFTokenToResponse } from '@/lib/csrf-middleware';
import logger from '@/lib/logger';
import { voteRateLimiter } from '@/lib/rate-limit';
import { getCacheItem, setCacheItem } from '@/lib/cache-utils';
import { prisma } from '@/lib/db';

// Define validation schema for payment request
const paymentSchema = z.object({
  amount: z.number().positive().min(1, 'Amount must be greater than 0'),
  kitty_id: z.union([z.string().min(1), z.number().positive()]),
  phone_number: z.string().min(1, 'Phone number is required'),
  channel_code: z.number().optional(),
  auth_code: z.string().optional(),
  first_name: z.string().optional(),
  second_name: z.string().optional(),
  show_names: z.boolean().optional(),
  show_number: z.boolean().optional(),
  paymentMethod: z.enum(['mpesa', 'card'])
});

// Type for the validated payment data
type PaymentData = z.infer<typeof paymentSchema>;

// Wrap the route handler with CSRF protection middleware
const handler = async (request: NextRequest) => {
  try {
    // Enhanced rate limiting with burst allowance for voting traffic
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    // Use caching to speed up rate limit checks
    const cacheKey = `rate_limit:${clientIp}`;
    let rateLimitResult = getCacheItem<{ allowed: boolean; remaining: number; resetTime: number }>(cacheKey);
    
    if (!rateLimitResult) {
      rateLimitResult = voteRateLimiter.check(clientIp);
      // Cache the result briefly to reduce computation
      setCacheItem(cacheKey, rateLimitResult, 1000); // 1 second cache
    }
    
    // If rate limited, return 429 with proper headers
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          status: false, 
          message: 'Too many requests. Please try again shortly.' 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': voteRateLimiter.options.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
          }
        }
      );
    }
    
    // Safely parse the request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { status: false, message: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    // Validate request body against schema
    const validationResult = paymentSchema.safeParse(requestBody);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return NextResponse.json(
        { 
          status: false, 
          message: 'Invalid payment data',
          errors: validationResult.error.errors 
        },
        { status: 400 }
      );
    }
    
    // Validated data
    const validData: PaymentData = validationResult.data;
    const { 
      amount, 
      kitty_id, 
      phone_number, 
      channel_code = 63902,
      auth_code = '',
      first_name = '',
      second_name = '',
      show_names = false,
      show_number = true,
      paymentMethod 
    } = validData;

    // Convert phone number from 07xxxxxxxx to 2547xxxxxxxx format if needed
    let formattedPhone = phone_number;
    if (phone_number && phone_number.startsWith('07')) {
      formattedPhone = `254${phone_number.substring(1)}`;
    }
    
    // Sanitize and validate the phone number
    formattedPhone = formattedPhone.trim().replace(/\s+/g, '');
    if (!/^\d+$/.test(formattedPhone.replace(/^\+/, ''))) {
      return NextResponse.json(
        { status: false, message: 'Invalid phone number format' },
        { status: 400 }
      );
    }
    
    // Log phone format for debugging (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Original phone:', phone_number);
      console.log('Formatted phone:', formattedPhone);
    }
    
    // Prepare the payload with proper typing
    const payload: Record<string, any> = {
      amount,
      kitty_id,
      phone_number: formattedPhone,
      // Try both variable formats to ensure compatibility with both environments
      channel_code: process.env.NEXT_PUBLIC_ONEKITTY_CHANNEL_CODE || process.env.ONEKITTY_CHANNEL_CODE || channel_code, 
      auth_code: process.env.NEXT_PUBLIC_ONEKITTY_AUTH_CODE || process.env.ONEKITTY_AUTH_CODE || auth_code,
      show_number
    };
    
    // Log channel code and auth code for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using channel code:', payload.channel_code);
      console.log('Using auth code:', payload.auth_code ? '(Valid auth code present)' : 'MISSING AUTH CODE');
      console.log('Environment variables found:', {
        NEXT_PUBLIC_CHANNEL: !!process.env.NEXT_PUBLIC_ONEKITTY_CHANNEL_CODE,
        REGULAR_CHANNEL: !!process.env.ONEKITTY_CHANNEL_CODE,
      });
    }
    
    // Only include name fields if provided and show_names is true
    if (show_names) {
      payload.first_name = first_name;
      payload.second_name = second_name;
      payload.show_names = true;
    } else {
      // For M-Pesa, add default names if not provided
      payload.first_name = first_name || 'Customer';
      payload.second_name = second_name || 'Name';
      payload.show_names = false;
    }
    
    // Log the final payload for debugging (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Payment payload:', JSON.stringify(payload));
    }
    
    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
    
    try {
      // Add more detailed logging of the API endpoint being used
      const apiEndpoint = 'https://apisalticon.onekitty.co.ke/kitty/api/contribute/';
      console.log(`Making payment request to: ${apiEndpoint}`);
      
      // Make the request to the payment API with more comprehensive headers
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'VotingSystem/1.0',
          'X-Request-Source': 'voting-system-app'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      // Log full response details for debugging
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
      
      clearTimeout(timeoutId); // Clear the timeout if the request completes successfully

      // Parse the response
      let data;
      try {
        data = await response.json();
        // Log the response for debugging (remove in production)
        if (process.env.NODE_ENV !== 'production') {
          console.log('Payment API response:', JSON.stringify(data));
        }
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', parseError);
        return NextResponse.json(
          { 
            status: false, 
            message: 'Invalid response from payment server', 
            error: 'Response parsing error'
          },
          { status: 500 }
        );
      }
      
      // Handle non-OK responses
      if (!response.ok) {
        console.error('Payment API error:', data);
        return NextResponse.json(
          { status: false, message: data?.message || 'Payment failed', raw: data },
          { status: response.status }
        );
      }
      
      // Process successful response
      if (data && data.status) {
        // Asynchronously update vote counts without blocking response
        // This pattern ensures high performance even under heavy load
        try {
          const candidateId = String(kitty_id); // Convert to string for safety
          const voteCount = Math.max(1, Math.floor(amount / 10)); // At least 1 vote

          // Fire-and-forget vote increment to optimize response time
          setTimeout(async () => {
            try {
              // Direct Prisma call to update vote count
              await prisma.candidate.update({
                where: { id: candidateId },
                data: { votes: { increment: voteCount } }
              });
              console.log(`Successfully incremented votes for candidate ${candidateId} by ${voteCount}`);
            } catch (err) {
              console.error('Vote increment failed:', err);
            }
          }, 0);
        } catch (error) {
          // Just log the error - we don't want to fail the payment
          console.error('Error scheduling vote increment:', error);
        }

        // Create a response object
        const apiResponse = NextResponse.json({
          ...data,
          status: true,
          message: paymentMethod === 'mpesa' 
            ? data?.message || 'M-Pesa payment initiated. Please check your phone for the payment prompt.'
            : data?.message || 'Payment initiated successfully'
        });
        
        // Add CSRF token to the response for security
        return addCSRFTokenToResponse(apiResponse);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Error making API request:', fetchError);
      return NextResponse.json(
        { 
          status: false, 
          message: fetchError instanceof Error && fetchError.name === 'AbortError' 
            ? 'The payment request timed out. Please try again.'
            : 'Failed to connect to payment server', 
          error: fetchError?.toString() 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { status: false, message: 'Internal server error', error: error?.toString() },
      { status: 500 }
    );
  }
};

// Export the handler with CSRF protection
// Final safety check to ensure handler always returns a response
const safeHandler = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const response = await handler(request);
    // If the handler didn't return a response, return a default error
    if (!response) {
      return NextResponse.json(
        { status: false, message: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
    return response;
  } catch (error) {
    console.error('Unhandled error in payment handler:', error);
    return NextResponse.json(
      { status: false, message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
};

export const POST = csrfProtection(safeHandler);
