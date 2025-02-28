  export const PLANS = [
    {
      name: 'Free',
      slug: 'free',
      quota: 10,
      pagesPerPdf: 5,
      price: {
        amount: 0,
        razorpayPlanId: null, // Razorpay doesn't charge for free plans
      },
    },
    {
      name: 'Pro',
      slug: 'pro',
      quota: 50,
      pagesPerPdf: 25,
      price: {
        amount: 200, // Amount in your currency (e.g., USD)
        razorpayPlanId: 'plan_Q0pZtKWBYnvlEW', 
      },
    },
  ];
