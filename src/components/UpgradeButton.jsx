"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { trpc } from "@/app/_trpc/client";

const UpgradeButton = () => {
  const { mutate: createRazorpaySubscription, isPending } =
    trpc.createRazorpaySubscription.useMutation({
      onSuccess: ({ url }) => {
        window.location.href = url ?? "/dashboard/billing";
      },
    });

  return (
    <div className="">
      <Button onClick={() => createRazorpaySubscription()} className="w-full">
        {isPending ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            Upgrade now
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
};

export default UpgradeButton;
