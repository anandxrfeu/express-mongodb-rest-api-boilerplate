// Import SendGrid's mail client
import sgMail from "@sendgrid/mail"

// Set the API key from environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

/**
 * Sends a welcome email with a verification link to the user.
 */
export const sendWelcomeEmail = async (firstName, email, token) => {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL,
    subject: `Welcome to Remindr! Let’s confirm your email`,
    html:
      `
        <p>Hi ${firstName},</p>
        <p>Thanks for signing up! Please confirm your email address to activate your account:</p>
        <p><a href="https://<Your Company>.com/verify-email?token=${token}" target="_blank">Verify your email</a></p>
        <p>If you didn’t sign up, you can ignore this email.</p>
        <p>– The ${process.env.COMPANY_NAME} Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Welcome email sent!")
  }catch(err){
    console.log({error: err})
  }
}

/**
 * Sends a password reset email with a secure reset link to the user.
 */
export const sendPasswordResetEmail = async (firstName, email, token) => {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL,
    subject: `Reset your Remindr password`,
   html:
      `
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password for your Remindr account.</p>
        <p>If you made this request, click the button below to set a new password:</p>
        <p><a href="https://<Your Company>.com/reset-password?token=${token}" target="_blank">Reset My Password</a></p>
        <p>This link will expire in 1 hour. If you didn’t request a password reset, you can safely ignore this email.</p>
        <p>– The ${process.env.COMPANY_NAME} Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Password reset email sent!")
  }catch(err){
    console.log({error: err})
  }

}

/**
 * Sends an email reminder that the user’s trial is ending soon.
 */
export const sendTrialEndingEmail = async (firstName,email, trialEnd) => {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL,
    subject: `Your trial ends tomorrow`,
    html:
      `
        <p>Hi ${firstName},</p>
        <p>Your free trial will end on ${trialEnd}.</p>
        <p><a href="${process.env.APP_URL}/billing/portal">Manage Billing</a></p>
        <p>– The ${process.env.COMPANY_NAME} Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Trial End reminder email sent!")
  }catch(err){
    console.log({error: err})
  }

}

/**
 * Sends an email reminding the user their subscription will end soon.
 */
export const sendSubCancellationReminderEmail = async (firstName, email, subscriptionEndAt) => {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL,
    subject: `Your subscription will end soon`,
    html:
      `
        <p>Hi ${firstName},</p>
        <p>Your subscription is set to end on <strong>${subscriptionEndAt || "the current period end"}</strong>.</p>
        <p>You’ll keep access until then. You can resume anytime.</p>
        <p><a href="${process.env.APP_URL}/billing/portal">Manage Billing</a></p>
        <p>– The ${process.env.COMPANY_NAME} Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Subscription Cancellation Reminder Email sent!")
  }catch(err){
    console.log({error: err})
  }
}

/**
 * Sends an email confirming the user’s subscription has ended.
 */
export const sendSubCancellationConfirmationEmail = async (firstName, email, subscriptionEndedAt) => {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL,
    subject: `Your subscription has ended`,
    html:
      `
        <p>Hi ${firstName},</p>
        <p>Your subscription ended on <strong>${subscriptionEndedAt}</strong>.</p>
        <p>You can reactivate whenever you like.</p>
        <p><a href="${process.env.APP_URL}/pricing">Reactivate</a></p>
        <p>– The ${process.env.COMPANY_NAME} Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Subscription Cancellation Confirmation Email sent!")
  }catch(err){
    console.log({error: err})
  }
}
