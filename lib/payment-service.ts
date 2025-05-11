import { prisma } from '@/lib/db';
import axios from 'axios';
import { z, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Environment variables for OneKitty
const {
  ONE_KITTY_API_KEY = 'demo_api_key_for_testing',
  ONE_KITTY_API_HOST = 'https://api.onekitty.io',
  ONE_KITTY_CHANNEL_CODES = ''
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
  auth_code: z.string().min(1),
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
    let phone = parsed.phone_number.trim();
    // Normalize to 2547XXXXXXXX format
    if (phone.startsWith('07')) {
      phone = `254${phone.slice(1)}`;
    }
    phone = phone.replace(/\D/g, '');
    // Strict format: country code + mobile
    if (!/^2547\d{8}$/.test(phone)) {
      throw new ZodError([
        {
          code: 'custom',
          message: 'Invalid phone number format; expected 2547XXXXXXXX',
          path: ['phone_number']
        }
      ]);
    }
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
      auth_code: data.auth_code,
      show_number: data.show_number ?? true
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
      Authorization: `Bearer ${ONE_KITTY_API_KEY}`,
      'Idempotency-Key': idempotencyKey
    };

    console.log('Sending payment payload to OneKitty:', JSON.stringify(payload, null, 2));
    const response = await axios.post(url, payload, { headers, timeout: 15000 });
    console.log('Received OneKitty response:', JSON.stringify(response.data, null, 2));

    const { status, message, data: res } = response.data;
    return {
      status,
      message,
      transactionId: res?.transaction_id,
      checkoutUrl: res?.checkout_url
    };
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
