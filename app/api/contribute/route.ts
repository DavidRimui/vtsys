import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { csrfProtection, addCSRFTokenToResponse } from '@/lib/csrf-middleware';
import logger from '@/lib/logger';
import { voteRateLimiter } from '@/lib/rate-limit';
import { getCacheItem, setCacheItem } from '@/lib/cache-utils';
import { prisma } from '@/lib/db';
import { PaymentService } from '@/lib/payment-service';
import axios from 'axios';

// Define validation schema for payment request
const paymentSchema = z.object({
  amount: z.number().positive().min(1, 'Amount must be greater than 0'),
  kitty_id: z.union([z.string().min(1), z.number().positive()]),
  phone_number: z.string().min(1, 'Phone number is required'),
  channel_code: z.union([
    z.literal(63902),
    z.literal(63903),
    z.literal(55)
  ], {
    errorMap: () => ({ message: 'Channel code must be one of: 63902 (MPESA), 63903 (Airtel Money), or 55 (Card)' })
  }),
  auth_code: z.string().min(1, 'Auth code is required'),
  first_name: z.string().optional(),
  second_name: z.string().optional(),
  show_names: z.boolean().optional(),
  show_number: z.boolean().optional(),
  paymentMethod: z.enum(['mpesa', 'card', 'airtel']).optional()
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
    let { 
      amount, 
      kitty_id, 
      phone_number, 
      channel_code,
      auth_code,
      first_name = '',
      second_name = '',
      show_names = false,
      show_number = true,
      paymentMethod 
    } = validData;
    
    // Determine payment method from channel code if not explicitly provided
    if (!paymentMethod) {
      if (channel_code === 63902) {
        paymentMethod = 'mpesa';
      } else if (channel_code === 63903) {
        paymentMethod = 'airtel';
      } else if (channel_code === 55) {
        paymentMethod = 'card';
      }
    }

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
      // Use the provided channel_code instead of environment variables
      channel_code,
      auth_code,
      show_number
    };
    
    // Log channel code and auth code for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using channel code:', payload.channel_code);
      console.log('Using auth code:', payload.auth_code ? '(Valid auth code present)' : 'MISSING AUTH CODE');
      console.log('Environment variables found:', {
        NEXT_PUBLIC_CHANNEL: !!process.env.NEXT_PUBLIC_ONEKITTY_CHANNEL_CODE,
        REGULAR_CHANNEL: !!process.env.ONEKITTY_CHANNEL_CODE
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
    
    try {
      // Prepare the API request payload for PaymentService
      const apiPayload: {
        amount: number;
        kitty_id: string;
        phone_number: string;
        channel_code: number;
        auth_code: string;
        show_number: boolean;
        paymentMethod: 'mpesa' | 'airtel' | 'card';
        first_name?: string;
        second_name?: string;
        show_names?: boolean;
        return_url?: string;
      } = {
        amount: amount,
        kitty_id: kitty_id.toString(),
        phone_number: formattedPhone,
        channel_code: typeof payload.channel_code === 'string' ? parseInt(payload.channel_code) : payload.channel_code,
        auth_code: payload.auth_code, // Using the auth_code from request body
        show_number: show_number,
        paymentMethod: paymentMethod as 'mpesa' | 'airtel' | 'card'
      };
      
      // Add name fields if applicable
      if (show_names) {
        apiPayload.first_name = payload.first_name;
        apiPayload.second_name = payload.second_name;
        apiPayload.show_names = true;
      }
      
      // Include return URL for card payments
      if (paymentMethod === 'card') {
        const returnUrl = new URL(request.nextUrl.origin);
        returnUrl.pathname = '/payment/success';
        apiPayload.return_url = returnUrl.toString();
      }
      
      logger.info('Processing payment through PaymentService', {
        amount,
        kitty_id,
        paymentMethod,
        phone_format: formattedPhone.substring(0, 4) + '****' + formattedPhone.substring(formattedPhone.length - 4)
      });
      
      // Use the new PaymentService to process the payment directly
      // This handles API calls, validation, and database storage
      const result = await PaymentService.processDirectPayment(apiPayload);
      
      // Log the payment result
      logger.info('Payment processing result', {
        status: result.status,
        message: result.message,
        hasCheckoutUrl: !!result.data?.checkoutUrl,
        hasTransactionId: !!result.data?.transactionId
      });
      
      // Asynchronously update vote counts if the payment was initiated successfully
      if (result.status) {
        try {
          const candidateId = String(kitty_id);
          const voteCount = Math.max(1, Math.floor(amount / 10));
          
          // Fire-and-forget vote increment
          setTimeout(async () => {
            try {
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
          console.error('Error scheduling vote increment:', error);
        }
      }
      
      // Return the API response to the client
      return NextResponse.json({
        status: result.status,
        message: result.message,
        data: result.data,
      });
      
    } catch (error) {
      // Type the error as AxiosError for better handling
      const axiosError = error as import('axios').AxiosError;
      
      // Always log Axios errors in both production and development
      console.error('OneKitty API Error:', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        config: {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          timeout: axiosError.config?.timeout
        }
      });
      
      // Return a properly formatted error response
      return NextResponse.json(
        { 
          status: false, 
          message: axiosError.response?.data ? 
            (typeof axiosError.response.data === 'object' && axiosError.response.data !== null ? 
              (axiosError.response.data as any).message || 'Payment gateway error' : 
              'Payment gateway error') : 
            'Payment gateway error',
          error: axiosError.message
        },
        { status: axiosError.response?.status || 500 }
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
