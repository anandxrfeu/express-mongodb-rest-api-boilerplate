// Import Mongoose for MongoDB interaction
import mongoose from "mongoose";

export const connectDB = async () => {
  try{
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("MongoDB connected")

  }catch(err){
    console.log("Connection error", err.message)
  }
}
