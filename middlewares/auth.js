// Import required modules
import jwt from "jsonwebtoken"
import User from "../models/User.js"

// Middleware to authenticate users via JWT
const auth = async (req, res, next) => {

  try{
    const authHeader = req.header("Authorization")

    // Validate presence and format of Authorization header
    if(!authHeader || !authHeader.startsWith("Bearer ")){
      throw new Error("Authorization header missing or malformed.")
    }

    // Extract the token from the header
    const token = authHeader.replace("Bearer ", "")
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Find the user by ID and ensure:
    // - user is not soft-deleted
    // - token is still valid and part of user's active tokens
    const user = await User.findOne({_id:decoded._id, deletedAt: null, "tokens.token": token})
    if(!user){
      throw new Error("User not found.")
    }

    // Attach token and user to the request object for downstream use
    req.token = token
    req.user = user
    next()
  }catch(err){
    res.status(401).send({ error: 'Please authenticate.' })
  }
}

export default auth
