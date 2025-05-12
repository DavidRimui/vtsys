import { prisma } from '@/lib/db';
import axios from 'axios';
import { z, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Environment variables for OneKitty
const {
  ONE_KITTY_API_KEY = 'demo_api_key_for_testing',
  ONE_KITTY_API_HOST = 'https://apisalticon.onekitty.co.ke',
  ONE_KITTY_CHANNEL_CODES = '',
  ONEKITTY_CALLBACK_URL = 'https://vote-cagap07yn-rimuidavid.vercel.app/api/contribute/callback'
} = process.env;

// Only validate API key in production to make development/demo easier
if (process.env.NODE_ENV === 'production' && (!ONE_KITTY_API_KEY || ONE_KITTY_API_KEY === 'demo_api_key_for_testing')) {
  console.warn('WARNING: Using demo API key. For production, set a real ONE_KITTY_API_KEY environment variable');
}

// Allowed channel codes
const channelCodes = ONE_KITTY_CHANNEL_CODES
  .split(',')
  .map((s) => parseInt(s, 10))
  .filter((n) => !isNaN(n));

// Zod schema for payment data
const paymentSchema = z.object({
  amount: z.number().positive().min(1),
  kitty_id: z.string().min(1),
  phone_number: z.string().min(1),
  channel_code: z.number().refine(
    (c) => channelCodes.length === 0 || channelCodes.includes(c),
    { message: `Channel code must be one of: ${channelCodes.join(', ')}` }
  ),
  // auth_code is required and provided in the request body
  auth_code: z.string().min(1, 'Auth code is required'),
  first_name: z.string().optional(),
  second_name: z.string().optional(),
  show_names: z.boolean().optional(),
  show_number: z.boolean().optional(),
  paymentMethod: z.enum(['mpesa', 'airtel', 'card']).optional(),
  idempotencyKey: z.string().optional()
});

type PaymentRequestData = z.infer<typeof paymentSchema>;

// Response type
export interface PaymentResponse {
  status: boolean;
  message: string;
  data?: {
    transactionId: string;
    checkoutUrl: string;
  };
  errors?: Record<string, any>;
}

// Payment service to handle payment operations
export class PaymentService {
  /**
   * Main entry point: validates, normalizes, calls API, and persists
   */
  static async processDirectPayment(rawData: unknown): Promise<PaymentResponse> {
    // 1. Validate and normalize input
    let data: PaymentRequestData;
    try {
      data = this.validateAndNormalize(rawData);
    } catch (err) {
      if (err instanceof ZodError) {
        return { status: false, message: 'Validation error', errors: err.format() };
      }
      return { status: false, message: 'Invalid payment data' };
    }

    // 2. Generate or reuse idempotency key
    const idempotencyKey = data.idempotencyKey || uuidv4();

    // 3. Call OneKitty API
    let result;
    try {
      result = await this.callOneKitty(data, idempotencyKey);
    } catch (err: any) {
      await this.persistRequest(data, idempotencyKey, 'failed', err.message, null, null);
      return { status: false, message: err.message };
    }

    // 4. Persist request outcome
    await this.persistRequest(
      data,
      idempotencyKey,
      result.status ? 'processing' : 'failed',
      result.message,
      result.transactionId || null,
      result.checkoutUrl || null
    );

    // 5. Return clean response
    if (!result.status) {
      return { status: false, message: result.message };
    }
    return {
      status: true,
      message: result.message,
      data: {
        transactionId: result.transactionId!,
        checkoutUrl: result.checkoutUrl!
      }
    };
  }

  /**
   * Validates raw payload and normalizes phone number
   */
  private static validateAndNormalize(raw: unknown): PaymentRequestData {
    const parsed = paymentSchema.parse(raw);
    
    // Detailed logging to debug phone formatting issues
    console.log('Original phone number input:', parsed.phone_number);
    
    let phone = parsed.phone_number.trim();
    
    // Normalize to 2547XXXXXXXX format (required by OneKitty API)
    if (phone.startsWith('07')) {
      phone = `254${phone.slice(1)}`;
      console.log('Converted 07XXXXXXXX to 2547XXXXXXXX format:', phone);
    } else if (phone.startsWith('+254')) {
      phone = phone.substring(1); // Remove the plus sign
      console.log('Removed + from +254 format:', phone);
    } else if (!phone.startsWith('254') && phone.match(/^\d{9}$/)) {
      // If it's just 9 digits (without country code), add 254
      phone = `254${phone}`;
      console.log('Added 254 prefix to 9-digit number:', phone);
    }
    
    // Remove any non-digit characters
    phone = phone.replace(/\D/g, '');
    console.log('After removing non-digits:', phone);
    
    // Strict format: country code + mobile (must be 12 digits: 254XXXXXXXXX)
    if (!/^2547\d{8}$/.test(phone)) {
      console.error('Phone validation failed. Expected pattern: 2547XXXXXXXX, Got:', phone);
      throw new ZodError([
        {
          code: 'custom',
          message: `Invalid phone number format: ${phone}. Required format: 07XXXXXXXX (will be converted to 2547XXXXXXXX)`,
          path: ['phone_number']
        }
      ]);
    }
    
    console.log('Final normalized phone number:', phone);
    return { ...parsed, phone_number: phone };
  }

  /**
   * Calls OneKitty with idempotency header and logs response
   */
  private static async callOneKitty(
    data: PaymentRequestData,
    idempotencyKey: string
  ): Promise<{ status: boolean; message: string; transactionId?: string; checkoutUrl?: string }> {
    const url = `${ONE_KITTY_API_HOST}/v1/payments/contribute/`;
    const payload: Record<string, any> = {
      amount: data.amount,
      kitty_id: data.kitty_id,
      phone_number: data.phone_number,
      channel_code: data.channel_code,
      auth_code: data.auth_code, // Include auth_code in the payload as required by OneKitty API
      show_number: data.show_number ?? true,
      callback_url: ONEKITTY_CALLBACK_URL // Add the callback URL for payment notifications
    };
    
    // Always include optional fields if present
    if (data.paymentMethod) payload.payment_method = data.paymentMethod;
    if (data.show_names) {
      payload.show_names = true;
      payload.first_name = data.first_name || 'Customer';
      payload.second_name = data.second_name || 'Name';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.auth_code}`, // Use the auth_code from the request body
      'Idempotency-Key': idempotencyKey
    };

    console.log('Sending payment payload to OneKitty:', JSON.stringify(payload, null, 2));
    console.log('OneKitty API URL:', url);
    console.log('Headers (without auth token):', { 'Content-Type': headers['Content-Type'], 'Idempotency-Key': headers['Idempotency-Key'] });
    
    try {
      // Detailed Axios configuration with robust error handling
      const axiosConfig = {
        method: 'post',
        url,
        headers,
        data: payload,
        timeout: 30000, // Increased timeout to 30 seconds for reliability
        maxContentLength: 100000, // Set max content size
        validateStatus: (status: number) => status >= 200 && status < 500 // Accept all responses to handle errors properly
      };
      
      const response = await axios(axiosConfig);
      
      // Log detailed response info
      console.log('Received OneKitty response:',
        JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        }, null, 2)
      );
      
      // If response status is not successful, throw an error with details
      if (response.status >= 400) {
        throw new Error(`OneKitty API error (${response.status}): ${JSON.stringify(response.data)}`);
      }

      const { status, message, data: res } = response.data;
      return {
        status: !!status, // Ensure boolean
        message: message || 'Payment request processed',
        transactionId: res?.transaction_id,
        checkoutUrl: res?.checkout_url
      };
    } catch (error: any) {
      // Detailed error logging for troubleshooting API issues
      console.error('Error calling OneKitty API:', {
        message: error.message,
        isAxiosError: axios.isAxiosError(error),
        response: error.response ? {
          status: error.response.status,
          data: error.response.data
        } : 'No response',
        request: error.request ? 'Request was made but no response received' : 'No request',
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          timeout: error.config.timeout,
          headers: {
            ...error.config.headers,
            Authorization: error.config.headers?.Authorization ? '[REDACTED]' : undefined
          }
        } : 'No config'
      });
      
      // Handle different error scenarios
      if (axios.isAxiosError(error) && error.response) {
        // Server responded with an error status
        return {
          status: false,
          message: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        };
      } else if (axios.isAxiosError(error) && error.request) {
        // Request made but no response received (network error)
        return {
          status: false,
          message: 'Network error - the payment gateway could not be reached. Please check your connection.',
        };
      } else {
        // Other errors (setup, etc)
        throw error; // Re-throw to be handled by the caller
      }
    }
  }

  /**
   * Persists or updates a payment record by idempotency key
   */
  private static async persistRequest(
    data: PaymentRequestData,
    idempotencyKey: string,
    status: string,
    message: string,
    transactionId: string | null,
    checkoutUrl: string | null
  ) {
    try {
      // Only attempt database operations if not in production or if DATABASE_URL is properly configured
      // This prevents errors in environments like Vercel preview deployments where database might not be available
      if (process.env.NODE_ENV !== 'production' || (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost'))) {
        // Using a type assertion to handle potential model name differences
        // This ensures compatibility with different Prisma versions and configurations
        const prismaClient = prisma as any;
        
        await prismaClient.paymentRequest.upsert({
          where: { id: idempotencyKey },
          create: {
            id: idempotencyKey,
            amount: data.amount,
            candidateId: data.kitty_id,
            channelCode: data.channel_code,
            phoneNumber: data.phone_number,
            paymentMethod: data.paymentMethod || 'mpesa',
            firstName: data.first_name || null,
            secondName: data.second_name || null,
            showNames: data.show_names || false,
            showNumber: data.show_number ?? true,
            status,
            responseMessage: message,
            transactionId,
            checkoutUrl
          },
          update: {
            status,
            responseMessage: message,
            transactionId,
            checkoutUrl,
            updatedAt: new Date()
          }
        });
      } else {
        // In production without a proper database, log the payment data but don't try to persist it
        console.log(`[PRODUCTION FALLBACK] ${new Date().toISOString()} - ${idempotencyKey}`, {
          data,
          status,
          message,
          transactionId,
          checkoutUrl
        });
      }
    } catch (err) {
      console.error('DB persistence error:', err);
      console.log(`[FALLBACK] ${new Date().toISOString()} - ${idempotencyKey}`, {
        data,
        status,
        message,
        transactionId,
        checkoutUrl
      });
    }
  }
}
