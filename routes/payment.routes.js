import express from "express";
import Stripe from "stripe";
import User from "../models/User.js";
import PaymentEvent from "../models/PaymentEvent.js";
import auth from "../middlewares/auth.js";
import { sendTrialEndingEmail, sendSubCancellationReminderEmail, sendSubCancellationConfirmationEmail} from "../services/email.services.js";
import { extractFirstName } from "../utils/stringUtils.js";

const paymentRouter = new express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * HELPER Functions
 */

// Apply Stripe subscription details to a User model
const applySubscriptionToUser = (user, sub) => {
  if (!sub) return user;

  const items = sub?.items?.data ?? [];
  const it = items[0] || null;

  const priceId   = it?.price?.id ?? sub?.plan?.id ?? null;
  const productId = it?.price?.product ?? sub?.plan?.product ?? null;

  // Fallback to item-level period bounds when top-level are missing (classic billing mode)
  const rawPeriodStart = sub.current_period_start ?? it?.current_period_start ?? null;
  const rawPeriodEnd   = sub.current_period_end   ?? it?.current_period_end   ?? null;

  // During trials, prefer trial_end; otherwise use the resolved period end
  const periodEndUnix =
    sub.status === "trialing"
      ? (sub.trial_end ?? rawPeriodEnd)
      : rawPeriodEnd;

  user.subscription = {
    id: sub.id,
    status: sub.status,
    priceId,
    productId,
    currentPeriodStart: rawPeriodStart ? new Date(rawPeriodStart * 1000) : null,
    currentPeriodEnd:   periodEndUnix  ? new Date(periodEndUnix  * 1000) : null,

    // trials
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd:   sub.trial_end   ? new Date(sub.trial_end   * 1000) : null,

    // cancel flags
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    scheduledCancelAt: sub.cancel_at   ? new Date(sub.cancel_at   * 1000) : null,
    canceledAt:        sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,

    // keep any previous diagnostic fields if you store them
    lastInvoiceId: user.subscription?.lastInvoiceId ?? null,
    lastPaymentError: user.subscription?.lastPaymentError ?? null,
    nextPaymentAttemptAt: user.subscription?.nextPaymentAttemptAt ?? null,
  };

  if (!user.stripeCustomerId && typeof sub.customer === "string") {
    user.stripeCustomerId = sub.customer;
  }
  return user;
};

// Extract customerId from a Stripe event payload
const getCustomerIdFromEvent = (event) => {
  const obj = event.data?.object ?? {};
  return (
    obj.customer ??
    obj.customer_id ?? // rare
    (obj.subscription && obj.subscription.customer) ?? null
  );
}

// Extract subscriptionId from a Stripe event payload
const getSubscriptionIdFromEvent = (event) => {
  const obj = event.data?.object ?? {};
  return (
    obj.subscription?.id ??
    obj.subscription ??
    null
  );
}

// Check if customer has an active or trialing subscription
const userHasActiveOrTrialSub = async (stripeCustomerId) => {
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 3,
  });
  return subs.data.find(s => s.status === "active" || s.status === "trialing") || null;
}

// Check if customer has ever used a trial subscription
const customerHasEverTrialed = async (stripeCustomerId) => {

  // Look at *all* subs for this customer; any with a trial window counts
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100, // defensive; most customers won’t hit this
  });
  return subs.data.some(s => !!s.trial_start); // trial used if any sub had a trial
}

// Format date in user's timezone as localized string
const formatInUserTZ = (date, user) => {
  if (!date) return null;
  const tz = user?.timezone || "UTC";
  return date.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: tz });
}

// Send trial ending soon email to user
const handleTrialEndingSoon = async (customerId, subscription) => {
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) return;

  // Get trial_end (epoch seconds → ISO)
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null

  await sendTrialEndingEmail( extractFirstName(user.fullName), user.email, formatInUserTZ(trialEnd, user));
}

// Send cancellation scheduled reminder email
const handleCancellationScheduled = async (customerId, subscription) =>  {
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) return;

  const endAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null
  await sendSubCancellationReminderEmail(
    extractFirstName(user.fullName),
    user.email,
    formatInUserTZ(endAt, user),
  );
}

// Send cancellation confirmed notification email
const handleCancellationConfirmed = async (customerId, subscription) =>  {
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) return;

  const endedAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(); // fallback
  await sendSubCancellationConfirmationEmail(
    extractFirstName(user.fullName),
    user.email,
    formatInUserTZ(endedAt, user)
  );
}

/**
 * Endpoints
 */


/**
 * POST /billing/create-checkout-session
 * Initiate a new Stripe Checkout session for a subscription purchase
 * and return the payment URL to the client
 */
paymentRouter.post("/billing/create-checkout-session", auth, async (req, res) => {
  try {
    const { productId, lookup_key } = req.body || {};
    const user = req.user; // set by auth

    // Ensure user has a linked Stripe customerId
    if (!user?.stripeCustomerId) {
      return res.status(409).send({ error: "Stripe customer not linked to user." });
    }

    // Check if user already has an active or trial subscription
    const validSub = await userHasActiveOrTrialSub(user.stripeCustomerId);
    if (validSub) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.APP_URL}/dashboard`,
      });
      return res.status(200).send({ portalUrl: portal.url, alreadySubscribed: true });
    }

    // Determine if user has ever used a trial before
    const everTrialed = await customerHasEverTrialed(user.stripeCustomerId);

    // Look up price securely on the server (prevents client-side tampering)
    const prices = await stripe.prices.list({
      product: productId,
      lookup_keys: [lookup_key],
      expand: ["data.product"],
      active: true,
      limit: 1,
    });

    if (!prices.data.length) {
      return res.status(400).send({ error: "No matching active price for productId + lookup_key." });
    }

    const price = prices.data[0];

    // Build session parameters for Stripe Checkout
    const sessionParams = {
      mode: "subscription",
      customer: user.stripeCustomerId,

      line_items: [{ price: price.id, quantity: 1 }],

      // Collect address and allow promotions
      billing_address_collection: "auto",
      customer_update: { address: "auto" },
      allow_promotion_codes: true,

      // Redirects after success/cancel
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pricing?canceled=1`,

      // Store references for fulfillment
      client_reference_id: String(user._id),
      metadata: {
        userId: String(user._id),
        productId,
        priceId: price.id,
        planLookupKey: lookup_key,
      },
      subscription_data: {
        // Add trial only if customer has never trialed
        ...(everTrialed ? {} : { trial_period_days: 7 }),
        metadata: {
          userId: String(user._id),
          productId,
          priceId: price.id,
          planLookupKey: lookup_key,
        },
      },
    };

    // Create a new checkout session in Stripe
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).send({ url: session.url });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
});

/**
 * POST /billing/webhook
 * Stripe webhook receiver for subscription lifecycle and billing events.
 */
paymentRouter.post("/billing/webhook",
  express.raw({type: "application/json"}),
  async (req, res) => {
    const sig = req.headers["stripe-signature"]

    let event
    // Step 0: Verify Stripe webhook signature against the raw body
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    }catch(err){
      console.log("err > ", err)
      return res.status(400).send({error: "Signature verification failed"});
    }

    // Step 1: Idempotency guard → persist event record if not already stored
    const exists = await PaymentEvent.findOne({ eventId: event.id }).lean();
    if (!exists) {
      await PaymentEvent.create({
        eventId: event.id,
        type: event.type,
        customerId: getCustomerIdFromEvent(event),
        subscriptionId: getSubscriptionIdFromEvent(event),
        payload: event,
      });
    }

    try{
      // Step 2: Route events by type
      switch (event.type) {

        // Initial checkout completion → hydrate subscription and map to user
        case "checkout.session.completed": {
          const session = event.data.object;
          // Only relevant for subscriptions
          if (session.mode !== "subscription") break;

          // Resolve subscription (expanded to include product/price)
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

          if (!subId) break;

          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ["items.data.price"],
          });

          // Find user by Stripe customerId or fallback to email
          let user = await User.findOne({ stripeCustomerId: sub.customer });
          if (!user && session.customer_details?.email) {
            user = await User.findOne({ email: session.customer_details.email.toLowerCase() });
          }
          if (!user) break; // no user to apply; you may want to alert

           // Apply subscription mapping and save
          applySubscriptionToUser(user, sub);
          await user.save();
          break;
        }

        // Async payment (e.g. boleto) success → hydrate and map subscription
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object;
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

          if (!subId) break;

          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ["items.data.price"],
          });

          let user = await User.findOne({ stripeCustomerId: sub.customer });
          if (!user && session.customer_details?.email) {
            user = await User.findOne({ email: session.customer_details.email.toLowerCase() });
          }
          if (!user) break;

          applySubscriptionToUser(user, sub);
          await user.save();
          break;
        }

        // Async payment failed → mark failure in PaymentEvent
        case "checkout.session.async_payment_failed": {
          const session = event.data.object;
          // Optional: link to user by email/customer and record a friendly message
          let user = await User.findOne({ stripeCustomerId: session.customer }).lean();
          if (!user && session.customer_details?.email) {
            user = await User.findOne({ email: session.customer_details.email.toLowerCase() }).lean();
          }
          // You might store a message for the UI:
          await PaymentEvent.updateOne({ eventId: event.id }, { $set: { note: "Async payment failed" }});
          break;
        }

        // Subscription create/update → handle trial transitions, cancel toggles, or hydration
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          // May be partial
          const subRaw = event.data.object;
          const prev   = event.data.previous_attributes || {};

          // Detect key transitions
          const justExitedTrial = prev.status === "trialing" && subRaw.status === "active";
          const flippedCancelOn = prev.cancel_at_period_end === false && subRaw.cancel_at_period_end === true;

          // Decide if hydration is needed (missing period bounds, status transitions, etc.)
          const item = subRaw.items?.data?.[0];
          const hasTopLevelPeriod = !!(subRaw.current_period_start && subRaw.current_period_end);
          const hasItemPeriod = !!(item?.current_period_start && item?.current_period_end);

          // Hydrate if we just left trial, just flipped cancel-on, or we're active with missing period bounds
          const needsHydration =
            justExitedTrial ||
            flippedCancelOn ||
            (subRaw.status === "active" && !(hasTopLevelPeriod || hasItemPeriod));

          // Hydrate subscription if necessary
          const sub = needsHydration
            ? await stripe.subscriptions.retrieve(subRaw.id) // plain retrieve is fine
            : subRaw;

          // Resolve user, map and save subscription state
          let user = await User.findOne({ stripeCustomerId: sub.customer });
          if (!user) break;

          applySubscriptionToUser(user, sub);
          await user.save();

          // If cancel was scheduled, trigger reminder
          if(flippedCancelOn){
            handleCancellationScheduled(sub.customer, sub)
          }
          break;
        }

        // Subscription deleted → mark status as canceled and notify user
        case "customer.subscription.deleted": {
          // Deleted payload is complete; no need to hydrate
          const sub = event.data.object;

          let user = await User.findOne({ stripeCustomerId: sub.customer });
          if (!user) break;

          // Map & save (status becomes 'canceled', canceled_at is set)
          applySubscriptionToUser(user, sub);
          await user.save();

          handleCancellationConfirmed(sub.customer, sub)
          break;
        }

        // Payment succeeded → hydrate subscription if partial and save invoice ref
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          if (invoice.subscription) {
            let subRaw = invoice.subscription;

            // Hydrate subscription if payload is partial
            if (typeof subRaw === "string") {
              subRaw = await stripe.subscriptions.retrieve(subRaw, {
                expand: ["items.data.price.product"],
              });
            }

            const item = subRaw.items?.data?.[0];
            const hasTopLevelPeriod = !!(subRaw.current_period_start && subRaw.current_period_end);
            const hasItemPeriod = !!(item?.current_period_start && item?.current_period_end);

            // Force hydrate if trial→active transition or no period fields at all
            const needsHydration =
              (subRaw.status === "active" && !hasTopLevelPeriod && !hasItemPeriod);

            const sub = needsHydration
              ? await stripe.subscriptions.retrieve(subRaw.id, {
                  expand: ["items.data.price.product"],
                })
              : subRaw;

            let user = await User.findOne({ stripeCustomerId: sub.customer });
            user.subscription.lastInvoiceId = invoice.id
            if (user) {
              applySubscriptionToUser(user, sub);
              await user.save();
            }
          }
          break;
        }

        // Payment failed → record failure reason and next attempt timestamp
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const subId = invoice.subscription;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
            const user = await User.findOne({ stripeCustomerId: sub.customer });
            if (user) {
              // record failure details
              user.subscription = user.subscription || {};
              user.subscription.lastInvoiceId = invoice.id;
              user.subscription.lastPaymentError =
                invoice?.last_finalization_error?.message ||
                invoice?.last_payment_error?.message || // older patterns
                "Payment failed. Please update your card.";
              user.subscription.nextPaymentAttemptAt =
                invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null;

              // mirror status via your existing applySubscriptionToUser()
              applySubscriptionToUser(user, sub);
              await user.save();
            }
          }
          break;
        }

        // Trial nearing end → trigger trial-ending email
        case "customer.subscription.trial_will_end": {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          await handleTrialEndingSoon(customerId, subscription);
          break;
        }


        default:
        // Ignore other events for now
        break;
      }

      // Step 3: Optionally mark event as processed
      await PaymentEvent.updateOne(
        { eventId: event.id },
        { $set: { processedAt: new Date() } }
      );

      res.json({ received: true });


    }catch (err) {
      // Step 4: On error, persist handler failure for debugging
      await PaymentEvent.updateOne(
        { eventId: event.id },
        { $set: { handlerError: String(err) } }
      );
      return res.status(500).json({ received: false });
    }
})

/**
 * GET /billing/status
 * Check the authenticated user's unlock/billing status.
 */
paymentRouter.get("/billing/status", auth, async (req, res) => {

  const user = await User.findById(req.user.id);

  // 1) Check DB first → if already marked Pro, return cached status
  if (user?.isPro) {
    return res.send({
      unlocked: true,
      status: user.subscription?.status,
      periodEnd: user.subscription?.currentPeriodEnd
    });
  }

  const { session_id } = req.query;
  // If no session_id, return locked status (fallback to DB subscription if present)
  if (!session_id) {
    return res.send({ unlocked: false, status: user?.subscription?.status ?? "unknown" });
  }

  // 2) Reconcile with Stripe session
  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["subscription", "subscription.items.data.price"]
  });

  // Normalize customerId (string or object)
  const sessionCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  // Verify this Session belongs to the signed-in user
  if (user.stripeCustomerId && sessionCustomerId !== user.stripeCustomerId) {
    return res.status(403).json({ error: "Not your session." });
  }

  // Use subscription object from session as source of truth
  const sub = session.subscription && typeof session.subscription === "object"
    ? session.subscription
    : null;

  // Consider session paid/unlocked if payment succeeded or no payment required
  const isPaidNow =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"; // still consider async cases below

  if (sub && isPaidNow) {
    // Sync subscription state into DB
    applySubscriptionToUser(user, sub);
    await user.save();
    return res.json({
      unlocked: user.isPro,
      status: user.subscription?.status,
      periodEnd: user.subscription?.effectivePeriodEnd
    });
  }

  // If async method (e.g., boleto), wait for webhook confirmation
  return res.json({
    unlocked: false,
    status: user?.subscription?.status ?? "processing",
    note: "Waiting for payment confirmation"
  });

})

/**
 * GET /billing/portal
 * Create a Stripe Billing Portal session for the authenticated user
 * to manage subscriptions, payment methods, and invoices.
 */
paymentRouter.get("/billing/portal", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Ensure user has a linked Stripe customerId
    if (!user?.stripeCustomerId) {
      return res.status(400).send({ error: "No Stripe customer" });
    }

    // Create a new Stripe Billing Portal session for this customer
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/account` // redirect after portal exit
    });

    // Respond with the portal URL
    res.send({ url: session.url });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});


export default paymentRouter;
