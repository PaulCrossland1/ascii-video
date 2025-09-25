import { Buffer } from "node:buffer";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function bufferRequest(request: Request) {
  const arrayBuffer = await request.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "webhook secret missing" }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await bufferRequest(request);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const referenceId = session.client_reference_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  if (!referenceId) {
    console.warn("checkout completed without client_reference_id", session.id);
    return NextResponse.json({ received: true });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: referenceId,
          entitlement: "premium",
          stripe_customer_id: customerId,
        },
        { onConflict: "id" },
      );

    if (error) {
      console.error("supabase profile upgrade failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("webhook processing failed", error);
    const message = error instanceof Error ? error.message : "unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
