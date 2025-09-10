import { db } from "@/db";
import { headers } from "next/headers";
import crypto from "crypto";

export async function POST(req: Request) {
  console.log("[WEBHOOK] - Received a request.");

  try {
    const body = await req.text();
    const signature = (await headers()).get("x-razorpay-signature") || "";

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("[WEBHOOK] - Invalid signature.");
      return new Response("Invalid signature", { status: 400 });
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    console.log(`[WEBHOOK] - Received event: ${event}`);

    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      const userId = payment?.notes?.userId;

      if (!userId) {
        console.error("[WEBHOOK] - User ID not found in payment notes.");
        return new Response("User ID missing", { status: 400 });
      }

      console.log(`[WEBHOOK] - Updating user ${userId} to Pro plan.`);
      
      await db.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          razorpayPlanId: 'PRO_ONE_TIME',
          razorpaySubscriptionId: null,
          razorpayCurrentPeriodEnd: null,
          razorpayIsCanceled: false,
        },
      });

      console.log(`[WEBHOOK] - Successfully updated user ${userId}.`);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("[WEBHOOK] - Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}