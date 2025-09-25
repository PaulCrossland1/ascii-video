import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to your environment to enable premium upgrades.");
  }

  const apiVersion = (process.env.STRIPE_API_VERSION ?? "2024-06-20") as Stripe.StripeConfig["apiVersion"];
  stripeClient = new Stripe(secretKey, { apiVersion });
  return stripeClient;
}
