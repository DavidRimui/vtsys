import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import logger from '@/lib/logger';

/**
 * OneKitty payment callback handler
 * Processes callbacks from OneKitty payment gateway after a payment attempt
 * Updates payment status in the database
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the callback payload
    const payload = await request.json();
    logger.info('Payment callback received', { payload });

    // Validate the callback data
    if (!payload || !payload.transaction_id) {
      logger.error('Invalid callback payload', { payload });
      return NextResponse.json(
        { message: 'Invalid callback data' }, 
        { status: 400 }
      );
    }

    // Extract key information from the callback
    const { 
      transaction_id,
      status,
      message,
      payment_id,
      amount,
      kitty_id,
      phone_number,
      payment_status,
      payment_method
    } = payload;

    // Find the payment record in our database by transaction ID
    const paymentRecord = await prisma.paymentRequest.findFirst({
      where: { transactionId: transaction_id }
    });

    if (!paymentRecord) {
      // If transaction not found by transaction_id, try using payment_id (which might be our idempotency key)
      // This helps with reconciliation if we get callbacks for payments we don't have records for
      if (payment_id) {
        const paymentByIdempotency = await prisma.paymentRequest.findUnique({
          where: { id: payment_id }
        });
        
        if (paymentByIdempotency) {
          await prisma.paymentRequest.update({
            where: { id: payment_id },
            data: {
              status: payment_status || status || 'processed',
              responseMessage: message || 'Callback received',
              transactionId: transaction_id,
              updatedAt: new Date()
            }
          });
          
          logger.info('Payment updated by payment_id', { payment_id });
          return NextResponse.json({ success: true, message: 'Payment updated' });
        }
      }
      
      // Create a new payment record if we don't have it in our system
      logger.warn('Payment callback for unknown transaction', { transaction_id });
      
      try {
        await prisma.paymentRequest.create({
          data: {
            id: payment_id || transaction_id,
            transactionId: transaction_id,
            amount: amount ? parseFloat(amount) : 0,
            candidateId: kitty_id || 'unknown',
            phoneNumber: phone_number || 'unknown',
            paymentMethod: payment_method || 'mpesa',
            status: payment_status || status || 'processed',
            responseMessage: message || 'Created from callback',
            // Add required fields based on the Prisma schema
            channelCode: 63902, // Default to MPESA channel code
            // Connect or create candidate record
            candidate: {
              connectOrCreate: {
                where: { id: kitty_id || 'unknown' },
                create: {
                  id: kitty_id || 'unknown',
                  name: 'Unknown Candidate',
                  category: 'Unknown',
                  description: 'Candidate created from payment callback',
                  imageUrl: '/images/Nadia-Mukami.png', // Using an existing image from your public directory
                  votes: 0
                }
              }
            }
          }
        });
        
        logger.info('Created new payment record from callback', { transaction_id });
        return NextResponse.json({ success: true, message: 'Payment created from callback' });
      } catch (err) {
        logger.error('Failed to create payment from callback', { error: err });
        return NextResponse.json(
          { success: false, message: 'Failed to create payment record' },
          { status: 500 }
        );
      }
    }

    // Update the existing payment with the callback information
    await prisma.paymentRequest.update({
      where: { id: paymentRecord.id },
      data: {
        status: payment_status || status || 'processed',
        responseMessage: message || 'Callback processed',
        updatedAt: new Date(),
        // Only update these fields if they are provided in the callback
        ...(amount ? { amount: parseFloat(amount) } : {}),
        ...(payment_method ? { paymentMethod: payment_method } : {})
      }
    });

    logger.info('Payment callback processed successfully', { transaction_id });
    return NextResponse.json({ success: true, message: 'Callback processed' });
  } catch (error) {
    logger.error('Error processing payment callback', { error });
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle GET requests to the callback URL (useful for testing)
export async function GET() {
  return NextResponse.json(
    { message: 'OneKitty payment callback endpoint' },
    { status: 200 }
  );
}
