import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { privateProcedure, publicProcedure, router } from "./trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { z } from "zod";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { absoluteUrl } from "@/lib/utils";
import { getUserSubscriptionPlan, razorpay } from "@/lib/razorpay";
import { PLANS } from "@/config/razorpay";


export const appRouter = router({
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    // Check if the user is authenticated
    if (!user?.id || !user?.email) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Check if the user exists in the database
    const dbUser = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });

    // Create the user if they don't exist
    if (!dbUser) {
      await db.user.create({
        data: {
          id: user.id,
          email: user.email,
        },
      });
    }

    // Return the success flag
    return { success: true };
  }),

  //creating razoypay session

  //creating razoypay session
  createRazorpaySubscription: privateProcedure.mutation(async ({ ctx }) => {
    console.log("Mutation called");
    const { userId } = ctx;

    const billingUrl = absoluteUrl("/dashboard/billing");

    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is missing",
      });
    }

    try {
      // Fetch the user from the database
      const dbUser = await db.user.findFirst({
        where: {
          id: userId,
        },
      });

      if (!dbUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      // Fetch the user's subscription plan
      const subscriptionPlan = await getUserSubscriptionPlan();

      // If the user is already subscribed, redirect to the billing portal
      if (subscriptionPlan.isSubscribed && dbUser.razorpayCustomerId) {
        const razorpaySubscription = await razorpay.subscriptions.fetch(
          dbUser.razorpaySubscriptionId!
        );

        if (!razorpaySubscription.short_url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Subscription URL not found",
          });
        }

        return { url: razorpaySubscription.short_url, billingUrl };
      }

      // Find the Pro plan's Razorpay plan ID
      const plan = PLANS.find((plan) => plan.name === "Pro");
      if (!plan) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Plan not found",
        });
      }

      // Create a Razorpay Payment Link for the subscription
      const razorpayPaymentLink = await razorpay.paymentLink.create({
        amount: plan.price.amount * 100, // Amount in paise (e.g., 1000 = ₹10)
        currency: "INR",
        description: `Subscription for ${plan.name} Plan`,
        customer: {
          email: dbUser.email,
        },
        notify: {
          sms: true,
          email: true,
        },
        callback_url: billingUrl, // Redirect URL after payment
        callback_method: "get",
        notes: {
          userId: userId, // Metadata to identify the user
        },
      });

      // Ensure the payment link has a short_url
      if (!razorpayPaymentLink.short_url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Payment link URL not found",
        });
      }
5
      return { url: razorpayPaymentLink.short_url, billingUrl };
    } catch (error) {
      console.error("Error in createRazorpaySubscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }),

  // createStripeSession: privateProcedure.mutation(async ({ ctx }) => {
  //   console.log("Mutation called");
  //   const { userId } = ctx;

  //   const billingUrl = absoluteUrl("/dashboard/billing");

  //   if (!userId) {
  //     throw new TRPCError({
  //       code: "UNAUTHORIZED",
  //       message: "User ID is missing",
  //     });
  //   }

  //   // Fetch the user from the database
  //   const dbUser = await db.user.findFirst({
  //     where: {
  //       id: userId,
  //     },
  //   });

  //   if (!dbUser) {
  //     throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  //   }

  //   // Fetch the user's subscription plan
  //   const subscriptionPlan = await getUserSubscriptionPlan();

  //   // If the user is already subscribed, redirect to the billing portal

  //   if (subscriptionPlan.isSubscribed && dbUser.stripeCustomerId) {
  //     const stripeSession = await stripe.billingPortal.sessions.create({
  //       customer: dbUser.stripeCustomerId,
  //       return_url: billingUrl,
  //     });

  //     return { url: stripeSession.url };
  //   }

  //   const stripeSession = await stripe.checkout.sessions.create({
  //     success_url: billingUrl,
  //     cancel_url: billingUrl,
  //     payment_method_types: ["card", "paypal"],
  //     mode: "subscription",
  //     billing_address_collection: "auto",
  //     line_items: [
  //       {
  //         price: PLANS.find((plan) => plan.name === "Pro")?.price.priceIds.test,
  //         quantity: 1,
  //       },
  //     ],
  //     metadata: {
  //       userId: userId,
  //     },
  //   });

  //   return { url: stripeSession.url };
  // }),

  getUserFiles: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    return await db.file.findMany({
      where: {
        userId,
      },
    });
  }),

  getFileMessages: privateProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
        fileId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { fileId, cursor } = input;
      const limit = input.limit ?? INFINITE_QUERY_LIMIT;

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      const messages = await db.message.findMany({
        take: limit + 1,
        where: {
          fileId,
        },
        orderBy: {
          createdAt: "desc",
        },
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          isUserMessage: true,
          createdAt: true,
          text: true,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),

  getFileUploadStatus: privateProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
          userId: ctx.userId,
        },
      });

      if (!file) return { status: "PENDING" as const };

      return { status: file.uploadStatus };
    }),

  getFile: privateProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          key: input.key,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      return file;
    }),

  deleteFile: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      await db.file.delete({
        where: {
          id: input.id,
        },
      });

      return file;
    }),
});

export type AppRouter = typeof appRouter;
