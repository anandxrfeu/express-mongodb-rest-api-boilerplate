// Import necessary libraries
import express from "express";
import jwt from "jsonwebtoken"
import User from "../models/User.js";
import auth from "../middlewares/auth.js";
import isAdmin from "../middlewares/admin.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/email.services.js";
import { extractFirstName } from "../utils/stringUtils.js";

const userRouter = new express.Router();

/**
 * POST /signUp
 * Registers a new user OR reactivates a soft-deleted user
 */
userRouter.post("/signUp", async (req, res) => {
  try{

    const {email, password, fullName } = req.body
    let token = undefined
    // check for user reactivation scenario
    let existingUser = await User.findOne({email})
    if(existingUser){
      if(existingUser.deletedAt){
        // Restore soft-deleted user
        existingUser.deletedAt = null;
        existingUser.password = password;         // Will be hashed by pre-save hook
        existingUser.fullName = fullName;
        existingUser.role = "USER";
        existingUser.profileURL = null;
        token = await user.generateAuthToken("1h")
        await existingUser.save();
        await sendWelcomeEmail(extractFirstName(fullName), email, token)
        return res.status(201).send({user: existingUser, token});
      }else{
        return res.status(409).send({error: "Email already in use."})
      }
    }

    // Create a brand new user
    let user = new User(req.body);
    token = await user.generateAuthToken("1h")
    user = await user.save();
    await sendWelcomeEmail(extractFirstName(fullName), email, token)
    res.status(201).send({user, token})
  }catch(err){
    res.status(500).send({error: err.message})
  }
})



/**
 * GET /verifyEmail
 * Verifies a user's email address using the token sent via email
 */
userRouter.get("/verifyEmail", async (req, res) => {
  try{
    const token = req.query.token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // Find the user by ID and ensure:
    // - user is not soft-deleted
    // - token is still valid and part of user's active tokens
    const user = await User.findOne({
                              _id:decoded._id,
                              deletedAt: null,
                              "tokens.token": token
                            })
    if(!user){
      throw new Error("User not found.")
    }

    if (user.isEmailVerified) {
      return res.status(200).send({ message: "Email already verified." })
    }

    // Remove the token to prevent reuse
    user.tokens = user.tokens.filter(t => t.token !== token)
    //Verify User
    user.isEmailVerified = true
    await user.save()
    res.status(200).send({message: "Email address verified."})

  } catch(err){
    if (err.name === "TokenExpiredError") {
      return res.status(401).send({
        error: "Verification link expired. Please request a new one."
      })
    }
    res.status(500).send({error: err.message})
  }

})


/**
 * POST /login
 * Authenticate user and return JWT token
 */
userRouter.post("/login", async (req, res) => {
  try{
    const {email, password} = req.body
    const user = await  User.findUserByCredentials(email, password)
    if(!user){
      res.status(400).send({error: "User not found."})
    }
    const token =  await user.generateAuthToken()
    res.send({user, token})
  }catch(err){
    res.status(500).send({error: err.message})
  }
})


/**
 * POST /forgotPassword
 * Sends a password reset email to the user with a time-limited token
 */
userRouter.post("/forgotPassword", async (req, res) => {
  try{

    const {email} = req.body
    const user = await User.findOne({email, deletedAt: null})
    if(!user){
      return res.status(400).send({error: "User not found."})
    }
    const token = await user.generateAuthToken("1h")
    await sendPasswordResetEmail(extractFirstName(user.fullName), email, token)
    res.status(200).send({ message: "Reset email sent." });
  }catch(err){
    res.status(500).send({error: err.message})
  }
})

/**
 * POST /resetPassword
 * Resets the user's password using a valid token from the email link
 */
userRouter.post("/resetPassword", async (req, res) => {
  try{

    const {password, token} = req.body
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findOne({
                              _id:decoded._id,
                              deletedAt: null,
                              "tokens.token": token
                            })
    if(!user){
      throw new Error("User not found.")
    }

    // Remove the token to prevent reuse
    user.tokens = user.tokens.filter(t => t.token !== token)

    // Set new password
    user.password = password
    await user.save()
    res.status(200).send({message: "Password reset successfully."})

  }catch(err){
    // Handle token expiration or invalidity clearly
    if (err.name === "TokenExpiredError") {
      return res.status(401).send({ error: "Reset token has expired. Please request a new one." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(400).send({ error: "Invalid token." });
    }
    res.status(500).send({error: err.message})
  }

})



/**
 * GET /user/me
 * Get the authenticated user's own profile
 */
userRouter.get("/user/me", auth, async (req, res) => {
  try{
    res.send(req.user)
  }catch(err){
    res.status(500).send({error: err.message})
  }
})

/**
 * GET /user
 * Retrieve all users with optional filters, sorting, and pagination
 * Supported query params: active, limit, skip, sortBy, order
 */
userRouter.get("/user", auth, isAdmin, async (req, res) => {
  const match = {}
  if (req.query.active){
    match.deletedAt = req.query.active === "TRUE" ? null : { $ne: null }
  }
  if (req.query.role){
    match.role = req.query.role
  }
  const limit = parseInt(req.query.limit) || 10;   // Default 10
  const skip = parseInt(req.query.skip) || 0;      // Default 0
  const sortBy = req.query.sortBy || 'createdAt';
  const order = req.query.order === 'asc' ? 1 : -1;
  try{
    const users = await User.find({...match})
          .sort({ [sortBy]: order })
          .limit(limit)
          .skip(skip);
    res.send(users)
  }catch(err){
    res.status(500).send(err.message)
  }

})

/**
 * POST /logout
 * Logout from current session only (remove token from list)
 */
userRouter.post("/logout", auth, async (req, res) => {
  try{
    req.user.tokens = req.user.tokens.filter( token => token.token !== req.token)
    await req.user.save()
    res.status(204).end()
  }catch(err){
    res.status(500).send({error: err.message})
  }

})

/**
 * POST /logoutAll
 * Logout from all sessions (clears all tokens)
 */
userRouter.post("/logoutAll", auth, async (req, res) => {

  try{
    req.user.tokens = []
    await req.user.save()
    res.status(204).end()
  }catch(err){
    res.status(500).send({error: err.message})
  }

})

/**
 * PATCH /user/me
 * Update authenticated user's profile
 */
userRouter.patch("/user/me", auth, async (req, res) => {
  try{

    const allowedOperations = ["fullName", "password", "email", "role", "phone", "profileURL", "timezone"];
    const requestedUpdates = Object.keys(req.body)
    if (requestedUpdates.length === 0) {
      return res.status(400).send({ error: "No fields provided for update." });
    }

    const isOperationAllowed = requestedUpdates.every(operation => allowedOperations.includes(operation) )
    if(!isOperationAllowed){
      return res.status(405).send({error: "Operation not allowed."})
    }
    const {id} = req.user;
    //const user = await User.findByIdAndUpdate(id, req.body, {new:true, runValidators:true})
    const user = await User.findOne({_id: id, deletedAt: null})
    if(!user){
      return res.status(404).send({error: "User not found."})
    }

    // apply updates
    requestedUpdates.forEach(update => {
      user[update] = req.body[update]
    })
    await user.save()

    res.status(200).send(user)

  }catch(err){
    res.status(500).send({error: err.message})
  }
})


/**
 * DELETE /user/me
 * Soft delete authenticated user account
 */
userRouter.delete("/user/me", auth, async (req, res) => {
  try{
    const {id} = req.user;
    const user = await User.findOne({_id:id, deletedAt:null})

    // check if user exists
    if(!user){
      return res.status(404).send({error: "User not found."})
    }

    // check if already deleted
    if(user.deletedAt){
      return res.status(404).send({error: "User not found."})
    }

    // Proceed with soft delete
    user.deletedAt = new Date();
    await user.save()
    res.status(200).end()
  }catch(err){
    res.status(500).end({error: err.message})
  }
})


/**
 * GET /user/me/tasks
 * Get all tasks created by the user
 */
userRouter.get("/user/me/feedback", auth, async (req, res) => {
  try{
    await req.user.populate("feedbacks")
    res.send(req.user.feedbacks)
  }catch(err){
    res.status(500).send({error: err.message})
  }
})

// Export the router to be used in the app
export default userRouter;
