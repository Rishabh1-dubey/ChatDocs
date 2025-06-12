import { db } from '@/db'
import { headers } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('X-Razorpay-Signature') || ''

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch (error) {
    return new Response('Invalid JSON', { status: 400 })
  }

  const event = payload.event

  // ✅ Handle one-time payment or manual subscription via order.paid
  if (event === 'order.paid') {
    const payment = payload.payload.payment.entity
    const userId = payment.notes?.userId // Pass userId as note while creating Razorpay order

    if (!userId) {
      return new Response('User ID not found in payment notes', { status: 400 })
    }

    try {
      // ✅ Set user as subscribed for 30 days manually
      const now = new Date()
      const subscriptionEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

      await db.user.update({
        where: { id: userId },
        data: {
          razorpayCustomerId: payment.customer_id,
          razorpayCurrentPeriodEnd: subscriptionEnd,
          razorpayIsCanceled: false,
        },
      })
    } catch (error) {
      console.error('Failed to update user subscription:', error)
      return new Response('Database update failed', { status: 500 })
    }
  }

  // 🔴 Optionally Handle payment.failed (for logging or analytics)
  if (event === 'payment.failed') {
    const payment = payload.payload.payment.entity
    console.log(`Payment failed: ${payment.id}, userId: ${payment.notes?.userId || 'N/A'}`)
  }

  return new Response(null, { status: 200 })
}
