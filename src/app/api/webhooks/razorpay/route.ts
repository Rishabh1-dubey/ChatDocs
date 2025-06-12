import { db } from '@/db'

import { headers } from 'next/headers'
import crypto from 'crypto'


export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers() // Correct way to access headers
  const signature = headersList.get('X-Razorpay-Signature') || ''

  // Verify the webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const payload = JSON.parse(body)
  const event = payload.event

  // Handle subscription charged event
  if (event === 'subscription.charged') {
    const subscription = payload.payload.subscription.entity
    const userId = subscription.notes.userId // Assuming you pass userId in notes

    if (!userId) {
      return new Response('User ID not found in subscription notes', { status: 400 })
    }

    // Update the user's subscription details in the database
    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        razorpaySubscriptionId: subscription.id,
        razorpayCustomerId: subscription.customer_id,
        razorpayPlanId: subscription.plan_id,
        razorpayCurrentPeriodEnd: new Date(subscription.current_end * 1000),
        razorpayIsCanceled: false, // Reset canceled status on successful charge
        
      },
    })
  }

  // Handle subscription canceled event
  if (event === 'subscription.cancelled') {
    const subscription = payload.payload.subscription.entity
    const userId = subscription.notes.userId // Assuming you pass userId in notes

    if (!userId) {
      return new Response('User ID not found in subscription notes', { status: 400 })
    }

    // Mark the subscription as canceled in the database
    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        razorpayIsCanceled: true,
      },
    })
  }

  return new Response(null, { status: 200 })
}