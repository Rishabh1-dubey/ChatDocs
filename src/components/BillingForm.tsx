'use client';

import { trpc } from '@/app/_trpc/client';
import MaxWidthWrapper from './MaxWidthWrapper';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserSubscriptionPlan } from '@/lib/razorpay';

interface BillingFormProps {
  subscriptionPlan: Awaited<ReturnType<typeof getUserSubscriptionPlan>>;
}

const BillingForm = ({ subscriptionPlan }: BillingFormProps) => {
  const { toast } = useToast();

  const { mutate: createRazorpaySubscription, status } =
    trpc.createRazorpaySubscription.useMutation({
      onSuccess: ({ url }) => {
        if (url) {
          window.location.href = url; // Redirect to Razorpay payment page
        } else {
          toast({
            title: 'There was a problem...',
            description: 'Please try again in a moment',
            variant: 'destructive',
          });
        }
      },
      onError: (error) => {
        toast({
          title: 'Payment Failed',
          description: error.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      },
    });

  return (
    <MaxWidthWrapper className="max-w-5xl">
      <form
        className="mt-12 relative"
        method="POST"
        onSubmit={(e) => {
          e.preventDefault();
          createRazorpaySubscription();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>
              You are currently on the{' '}
              {/* @ts-ignore */}
              <strong>{subscriptionPlan.name}</strong> plan.
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
            <Button type="submit" disabled={status === 'pending'}>
              {status === 'pending' ? (
                <Loader2 className="mr-4 h-4 w-4 animate-spin" />
              ) : null}
              {subscriptionPlan.isSubscribed
                ? 'Manage Subscription'
                : 'Upgrade to PRO'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </MaxWidthWrapper>
  );
};

export default BillingForm;