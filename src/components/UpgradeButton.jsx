"use client"
import { Button } from './ui/button'
import { ArrowRight } from 'lucide-react'
import { trpc } from '@/app/_trpc/client'


const UpgradeButton = () => {

  const {mutate:createRazorpaySubscription} = trpc.createRazorpaySubscription.useMutation({
    onSuccess:({url})=>{
      window.location.href= url ?? '/dashboard/billing'
    }
  })
  return (
    <Button onClick={()=>createRazorpaySubscription()} className='w-full'>
        Upgrade now <ArrowRight className='h-5 w-5 ml-1.5'/>
    </Button>
  )
}

export default UpgradeButton