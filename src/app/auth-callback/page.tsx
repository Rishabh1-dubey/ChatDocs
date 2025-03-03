"use client";

import { useRouter } from "next/navigation";
import { trpc } from "../_trpc/client";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// ✅ Correct type for App Router page props
interface AuthCallbackPageProps {
  searchParams: Record<string, string | string[] | undefined>; 
}

const Page = ({ searchParams }: AuthCallbackPageProps) => {
    const router = useRouter();
    const origin = typeof searchParams?.origin === "string" ? searchParams.origin : undefined;

    const { data, error } = trpc.authCallback.useQuery();

    useEffect(() => {
        if (data?.success) {
            router.push(origin ? `/${origin}` : "/dashboard");
        }
    }, [data, origin, router]);

    useEffect(() => {
        if (error?.data?.code === "UNAUTHORIZED") {
            router.push("/sign-in");
        }
    }, [error, router]);

    return (
        <div className="w-full mt-24 flex justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-800" />
                <h3 className="font-semibold text-xl">Setting Up Your Account.....</h3>
                <p>You will be redirected automatically.</p>
            </div>
        </div>
    );
};

export default Page;
