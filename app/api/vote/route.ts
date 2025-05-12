import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { PaymentService } from '@/lib/payment-service';

// Schema for incoming vote request
const voteSchema = z.object({
  kitty_id: z.number().int().positive(),
  votes: z.number().int().positive(),
  phone_number: z.string().min(1),
  channel_code: z.number().refine(c => [63902, 63903, 55].includes(c), {
    message: 'Channel code must be one of: 63902 (MPESA), 63903 (Airtel), 55 (Card)'
  }),
  auth_code: z.string().min(1),
  first_name: z.string().optional(),
  second_name: z.string().optional(),
  show_names: z.boolean().optional(),
  show_number: z.boolean().optional()
});

type VoteRequest = z.infer<typeof voteSchema>;

export async function POST(request: NextRequest) {
  let data: unknown;

  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ status: false, message: 'Invalid JSON' }, { status: 400 });
  }

  // Validate
  let payload: VoteRequest;
  try {
    // Ensure kitty_id is a number if passed as a string
    if (typeof data.kitty_id === 'string') {
      data.kitty_id = parseInt(data.kitty_id, 10);
    }
    payload = voteSchema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ status: false, message: 'Validation error', errors: err.format() }, { status: 400 });
    }
    return NextResponse.json({ status: false, message: 'Unknown validation error' }, { status: 400 });
  }

  // Calculate amount at KES 10 per vote
  const amount = payload.votes * 10;

  // Dynamically determine callback URL based on current request
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host');
  const callback_url = `${protocol}://${host}/voting/api/contribute/callback`;

  // Prepare OneKitty payload
  const paymentData = {
    amount,
    kitty_id: payload.kitty_id,
    phone_number: payload.phone_number,
    channel_code: payload.channel_code,
    auth_code: payload.auth_code,
    first_name: payload.first_name,
    second_name: payload.second_name,
    show_names: payload.show_names ?? true,
    show_number: payload.show_number ?? true,
    callback_url // Pass dynamically generated callback URL
  };

  // Process payment
  try {
    const result = await PaymentService.processDirectPayment(paymentData);
    const status = result.status ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (err: any) {
    console.error('Error processing payment:', err);
    return NextResponse.json({ status: false, message: 'Payment processing failed' }, { status: 500 });
  }
}
