import Dashboard from "@/components/Dashboard";
import { db } from "@/db";
import { getUserSubscriptionPlan } from "@/lib/razorpay";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { redirect } from "next/navigation";

const Page = async() => {
  const { getUser } = getKindeServerSession();
  const user =  await getUser()

if(!user || !user.id) redirect ('/auth-callback?origin=dashboard')

const dbuser = await db.user.findFirst({
  where:{
    id:user.id
  }
})

if(!dbuser)  redirect('/auth-callback?origin=dashboard')

  const subscriptionPlan = await getUserSubscriptionPlan()
  return <Dashboard  subscriptionPlan={subscriptionPlan}/>

 
}

export default Page;