/**
 * AROS Platform — Stripe Webhook Handler
 *
 * Processes Stripe events to keep tenant billing state in sync.
 * All DB writes go to Supabase via the admin client.
 */

import { constructWebhookEvent, planFromPriceId, type Stripe } from './stripe.js';
import { createSupabaseAdmin } from '../supabase.js';

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Process an incoming Stripe webhook request.
 * @param rawBody - Raw request body (must NOT be parsed as JSON)
 * @param signature - Value of the `stripe-signature` header
 */
export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string,
): Promise<WebhookResult> {
  // ── Verify signature ────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return { status: 400, body: { error: `Webhook signature verification failed: ${message}` } };
  }

  const supabase = createSupabaseAdmin();

  // ── Route by event type ─────────────────────────────────────
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      const plan = session.metadata?.plan || 'starter';

      if (tenantId && session.customer && session.subscription) {
        await supabase
          .from('tenants')
          .update({
            plan,
            license_tier: plan,
            stripe_customer_id: String(session.customer),
            stripe_subscription_id: String(session.subscription),
            billing_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      const priceId = subscription.items.data[0]?.price?.id || '';
      const plan = planFromPriceId(priceId);

      if (tenantId) {
        const updateFields: Record<string, unknown> = {
          billing_status: subscription.status === 'active' ? 'active' : subscription.status,
          updated_at: new Date().toISOString(),
        };
        if (plan) {
          updateFields.plan = plan;
          updateFields.license_tier = plan;
        }
        await supabase.from('tenants').update(updateFields).eq('id', tenantId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;

      if (tenantId) {
        await supabase
          .from('tenants')
          .update({
            plan: 'free',
            license_tier: 'free',
            billing_status: 'cancelled',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

      if (customerId) {
        await supabase
          .from('tenants')
          .update({
            billing_status: 'payment_failed',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return { status: 200, body: { received: true, type: event.type } };
}
