// Import necessary libraries
import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Define the User schema
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
  tokens: [{
    token: {
      type: String,
      required: true
    }
  }]
}, {
  timestamps: true
});


// Define a virtual field 'feedbacks' to establish a relationship between User and Feedback models
UserSchema.virtual("feedbacks", {
  ref: "Feedback",
  localField: "_id",
  foreignField: "owner"
})

// Enables Mongoose to include virtual fields during serialization
UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });

// Customize the JSON output by removing unwanted internal fields when the User object is serialized
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  // Remove sensitive or unnecessary fields
  delete user.password
  delete user.tokens
  delete user.__v
  return user
}

// Instance method to generate an authentication token using JWT
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

// Static method to authenticate a user using email and password
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

// Mongoose middleware to hash password before saving if it has been modified
UserSchema.pre("save", async function(next){
  let user = this;
  if(user.isModified("password")){
    const salt = await bcrypt.genSalt(parseInt(process.env.SALT_ROUNDS))
    user.password = await bcrypt.hash(user.password, salt)
  }
  next()
})

// Compile the schema into a model
const User = mongoose.model("User", UserSchema);

// Export the model for use in other parts of the application
export default User;
