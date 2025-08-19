// Import necessary libraries
import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Allowed subscription statuses (mirrors Stripe states)
const SubscriptionStatus = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused"
];

// Subscription sub-schema embedded inside User
const SubscriptionSchema = new mongoose.Schema({
  id: { type: String, index: true }, // Stripe subscription id
  status: { type: String, enum: SubscriptionStatus },
  priceId: { type: String },
  productId: { type: String },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },

  // Trial windows (only set when status is 'trialing')
  trialStart: { type: Date, default: null },
  trialEnd: { type: Date, default: null },

  // Cancellation and payment details
  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date, default: null },
  lastInvoiceId: { type: String, default: null },
  lastPaymentError: { type: String, default: null },
  nextPaymentAttemptAt: { type: Date, default: null },
  scheduledCancelAt: { type: Date, default: null },

}, { _id: false, timestamps: false });


// User schema definition
const UserSchema = new mongoose.Schema({

  fullName:{
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v) => v.length > 0,
      message: "Name cannot be empty.",
    },
  },
  role:{
    type: String,
    enum: ["ADMIN", "USER"],
    required: true,
    default: "USER"
  },
  phone:{
    type: String,
    trim: true,
    validate: {
      validator: (v) => !v || validator.isMobilePhone(v),
      message: "Enter a valid phone number.",
    },
  },
  email:{
    type: String,
    unique: true,
    required: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: "Enter a valid email.",
    },
  },
  password:{
    type: String,
    required: true,
    validate: {
      validator: validator.isStrongPassword,
      message:
        "Password must have at least 8 characters including uppercase, lowercase, number, and symbol.",
    },
  },
  deletedAt: {
    type: Date,
  },
  profileURL:{
    type: String
  },
  isEmailVerified:{
    type: Boolean,
    default: false
  },
  // JWT tokens array
  tokens: [{
    token: {
      type: String,
      required: true
    }
  }],
  // User’s timezone (validated by Intl.DateTimeFormat)
  timezone: {
    type: String,
    default: "UTC",
    validate: {
      validator: (value) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: value });
          return true;
        } catch (err) {
          return false;
        }
      },
      message: "Invalid timezone.",
  },
  },
  // Stripe integration fields
  stripeCustomerId: {
    type: String,
    index: true,
    default: null
  },
  subscription: {
    type: SubscriptionSchema,
    default: null
  },

}, {
  timestamps: true
});

// Virtual flag: true if user has active or trialing subscription
UserSchema.virtual("isPro").get(function () {
  const s = this.subscription?.status;
  return s === "active" || s === "trialing";
});

// Virtual: return trialEnd if still in trial, else currentPeriodEnd
SubscriptionSchema.virtual("effectivePeriodEnd").get(function () {
  return this.status === "trialing" && this.trialEnd ? this.trialEnd : this.currentPeriodEnd;
});

// Virtual: user → reminders relationship
UserSchema.virtual("reminders", {
  ref: "Reminder",
  localField: "_id",
  foreignField: "owner"
})

// Virtual: user → feedback relationship
UserSchema.virtual("feedbacks", {
  ref: "Feedback",
  localField: "_id",
  foreignField: "owner"
})

// Enable inclusion of virtuals in JSON / object serialization
SubscriptionSchema.set("toObject", { virtuals: true });
SubscriptionSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });


// Customize JSON output: hide sensitive fields
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password
  delete user.tokens
  delete user.__v
  return user
}

// Instance method: generate and persist JWT for a user
UserSchema.methods.generateAuthToken = async function(expiresIn = process.env.JWT_EXPIRY) {
  const user = this
  const token = jwt.sign(
                      {_id: user._id.toString()},
                      process.env.JWT_SECRET,
                      {expiresIn: expiresIn}
                    )
  user.tokens = user.tokens.concat({token})
  await user.save()
  return token;
}

// Static method: find user by email/password
UserSchema.statics.findUserByCredentials = async (email, password) => {
  const user = await User.findOne({email,  deletedAt: null})

  if(!user){
    throw new Error ("User not found.")
  }
  const isValidPassword = await bcrypt.compare(password, user.password)
  if(!isValidPassword){
    throw new Error("Invalid password.")
  }
  return user
}

// Middleware: hash password and normalize email before save if modified
UserSchema.pre("save", async function(next){
  let user = this;

  // Normalize email to lowercase
  if (user.isModified("email") && typeof user.email === "string") {
    user.email = user.email.toLowerCase();
  }

  // Hash password if changed
  if(user.isModified("password")){
    const rounds = parseInt(process.env.SALT_ROUNDS, 10) || 10; // fallback to 10
    const salt = await bcrypt.genSalt(parseInt(rounds))
    user.password = await bcrypt.hash(user.password, salt)
  }
  next()
})

// Compile and export User model
const User = mongoose.model("User", UserSchema);
export default User;
