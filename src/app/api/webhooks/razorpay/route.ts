import { db } from '@/db'
import { headers } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = headers()

  const signature = (await headersList).get('X-Razorpay-Signature') || ''

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const payload = JSON.parse(body)
  const event = payload.event

  if (event === 'subscription.charged') {
    const subscription = payload.payload.subscription.entity
    const userId = subscription.notes.userId

    if (!userId) {
      return new Response('User ID not found in subscription notes', { status: 400 })
    }

    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        razorpaySubscriptionId: subscription.id,
        razorpayCustomerId: subscription.customer_id,
        razorpayPlanId: subscription.plan_id,
        razorpayCurrentPeriodEnd: new Date(subscription.current_end * 1000),
        razorpayIsCanceled: false,
      },
    })
  }

  if (event === 'subscription.cancelled') {
    const subscription = payload.payload.subscription.entity
    const userId = subscription.notes.userId

    if (!userId) {
      return new Response('User ID not found in subscription notes', { status: 400 })
    }

    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        razorpayIsCanceled: true,
      },
    })
  }

  if (event === 'payment.failed') {
    const payment = payload.payload.payment.entity
    console.log(`Payment failed: ${payment.id}, userId: ${payment.notes?.userId || 'N/A'}`)
    // You can log this or notify via email/slack if needed
  }

  return new Response(null, { status: 200 })
}
