import { PLANS } from "@/config/razorpay";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? "",
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? "",
});

export async function getUserSubscriptionPlan() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user?.id) {
    return {
      ...PLANS[0],
      isSubscribed: false,
    };
  }

  const dbUser = await db.user.findFirst({
    where: {
      id: user.id,
    },
  });

  if (!dbUser) {
    return {
      ...PLANS[0],
      isSubscribed: false,
    };
  }
  
  // The `isSubscribed` flag is now the single source of truth
  const isSubscribed = dbUser.isSubscribed;

  const plan = isSubscribed
    ? PLANS.find((plan) => plan.name === "Pro")
    : PLANS[0];

  return {
    ...plan,
    isSubscribed,
    // These fields are no longer critical for checking the plan status
    isCanceled: dbUser.razorpayIsCanceled,
    razorpaySubscriptionId: dbUser.razorpaySubscriptionId,
    razorpayCurrentPeriodEnd: dbUser.razorpayCurrentPeriodEnd,
    razorpayCustomerId: dbUser.razorpayCustomerId,
  };
}