// Import necessary libraries
import mongoose from "mongoose";

// Define the Feedback schema
const FeedbackSchema = new mongoose.Schema({

  type:{
    type: String,
    enum: ["BUG", "FEATURE", "OTHER"],
    required: true,
    default: "BUG"
  },
  title:{
    type: String,
    trim: true,
    required: true,
     validate: {
      validator: (v) => v.length > 0,
      message: "Title cannot be empty.",
    },
  },
  description: {
    type: String,
    trim: true,
  },
  screenshotURL:{
    type: String,
  },
  status:{
    type: String,
    enum: ["OPEN", "UNDER REVIEW", "RESOLVED"],
    default: "OPEN"
  },
  // Reference to the user who submitted the feedback
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// Customize the JSON output by removing unwanted internal fields when the Feedback object is serialized
FeedbackSchema.methods.toJSON = function() {
  const feedback = this.toObject()
  delete feedback.__v
  return feedback
}

// Compile the schema into a model
const Feedback = mongoose.model("Feedback", FeedbackSchema);

// Export the model for use in other parts of the application
export default Feedback;
