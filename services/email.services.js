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
        <p>– The <Your Company> Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Email sent!")
  }catch(err){
    console.log({error: err})
  }
}

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
        <p>– The <Your Company> Team</p>
      `
  }
  try{
    await sgMail.send(msg)
    console.log("Email sent!")
  }catch(err){
    console.log({error: err})
  }

}
