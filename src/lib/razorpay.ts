import { PLANS } from '@/config/razorpay';
import { db } from '@/db';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
});

export async function getUserSubscriptionPlan() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user.id) {
    return {
      ...PLANS[0],
      isSubscribed: true,
      isCanceled: false,
      razorpayCurrentPeriodEnd: null,
    };
  }

  const dbUser = await db.user.findFirst({
    where: {
      id:user.id,
    },
  });

  if (!dbUser) {
    return {
      ...PLANS[0],
      isSubscribed: false,
      isCanceled: false,
      razorpayCurrentPeriodEnd: null,
    };
  }

  const isSubscribed = Boolean(
    dbUser.razorpayPlanId &&
      dbUser.razorpayCurrentPeriodEnd && // 86400000 = 1 day
      dbUser.razorpayCurrentPeriodEnd.getTime() + 86_400_000 > Date.now()
  );



  const plan = isSubscribed
    ? PLANS.find((plan) => plan.price.razorpayPlanId === dbUser.razorpayPlanId)
    : PLANS[0];

  let isCanceled = false;
  if (isSubscribed && dbUser.razorpaySubscriptionId) {
    const razorpaySubscription = await razorpay.subscriptions.fetch(
      dbUser.razorpaySubscriptionId
    );
    isCanceled = razorpaySubscription.status === 'cancelled';
  }

  return {
    ...plan,
    razorpaySubscriptionId: dbUser.razorpaySubscriptionId,
    razorpayCurrentPeriodEnd: dbUser.razorpayCurrentPeriodEnd,
    razorpayCustomerId: dbUser.razorpayCustomerId,
    isSubscribed,
    isCanceled,
    
  };
}