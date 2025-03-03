import BillingForm from '@/components/BillingForm'
import { getUserSubscriptionPlan } from '@/lib/razorpay'
import React from 'react'




export const dynamic = "force-dynamic";

const page = async () => {

    const subscriptionPlan = await getUserSubscriptionPlan()
  return <BillingForm subscriptionPlan = {subscriptionPlan}/>
}

export default page