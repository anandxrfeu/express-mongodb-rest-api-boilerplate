// Import necessary libraries
import mongoose from "mongoose";

const PaymentEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true },        // Stripe event type (e.g., 'checkout.session.completed')
  eventId: {
    type: String,
    index: true },           // Stripe event.id or relevant object.id, used for idempotency checks
  customerId: {
    type: String,
    index: true,
    default: null },         // Associated Stripe customer (if available)
  subscriptionId: {
    type: String,
    index: true,
    default: null },         // Associated subscription (if available)
  payload: {
    type: Object,
    required: true },        // Full event payload (or sanitized version)
  processedAt: {
    type: Date,
    default: Date.now }      // Timestamp when the event was processed
}, { timestamps: true });

export default mongoose.model("PaymentEvent", PaymentEventSchema);
