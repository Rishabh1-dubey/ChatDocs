import { db } from "@/db";
import { headers } from "next/headers";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // 1️⃣ Get raw body and signature
    const body = await req.text();
    const headersList = headers();
    const signature = (await headersList).get("x-razorpay-signature") || "";
    

    // 2️⃣ Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    // 3️⃣ Parse payload
    const payload = JSON.parse(body);
    const event = payload.event;

    // Helper to get userId from notes
    const getUserIdFromPayload = () => {
      
      return (
        payload.payload?.subscription?.entity?.notes?.userId ||
        payload.payload?.payment?.entity?.notes?.userId ||
        null
      );
    };

    const userId = getUserIdFromPayload();
    if (!userId) {
      console.error(`No userId found in notes for event ${event}`);
      return new Response("User ID missing", { status: 400 });
    }


    // 4️⃣ Handle events
    if (["subscription.activated", "subscription.charged"].includes(event)) {
      const subscription = payload.payload.subscription.entity;
      const updateUser = await db.user.update({
        where: { id: userId },
        data: {
          razorpaySubscriptionId: subscription.id,
          razorpayCustomerId: subscription.customer_id,
          razorpayPlanId: subscription.plan_id,
          razorpayCurrentPeriodEnd: new Date(subscription.current_end * 1000),
          isSubscribed: true,
          razorpayIsCanceled: false,
        },
      });
      console.log(`✅ Subscription updated for user ${userId}`);
      console.log("updateuser ::::::", updateUser);
    }

    if (event === "subscription.cancelled") {
      await db.user.update({
        where: { id: userId },
        data: { razorpayIsCanceled: true, isSubscribed: false },
      });
      console.log(`⚠ Subscription cancelled for user ${userId}`);
    }

    if (event === "payment.failed") {
      const payment = payload.payload.payment.entity;
      console.error(`❌ Payment failed: ${payment.id} for user ${userId}`);
    }

    return new Response("Webhook received", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
