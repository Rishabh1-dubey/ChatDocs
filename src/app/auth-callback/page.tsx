"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "../_trpc/client";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin");

  // Use the useQuery hook
  const { data, error } = trpc.authCallback.useQuery();

  // Handle side effects with useEffect
  useEffect(() => {
    if (data?.success) {
      // Redirect based on the origin parameter
      router.push(origin ? `/${origin}` : "/dashboard");
    }
  }, [data, origin, router]);

  useEffect(() => {
    if (error?.data?.code === "UNAUTHORIZED") {
      // Redirect to sign-in if unauthorized
      router.push("/sign-in");
    }
  }, [error, router]);

  return (
    <div className="w-full mt-24 flex justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-800" />
        <h3 className="font-semibold text-xl"> Setting Up Your Account.....</h3>
        <p>You will be redirected automatically.</p>
      </div>
    </div>
  );
};

export default Page;
