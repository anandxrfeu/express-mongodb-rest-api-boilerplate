// Import necessary libraries
import express from "express";
import Feedback from "../models/Feedback.js";
import auth from "../middlewares/auth.js";

// Create a router for feedback-related endpoints
const feedbackRouter = express.Router();

/**
 * POST /feedback
 * Create a new feedback entry linked to the authenticated user
 */
feedbackRouter.post("/feedback", auth, async (req, res) => {
  try{
    let feedback = new Feedback({...req.body, owner: req.user._id})
    feedback = await feedback.save()
    res.status(201).send(feedback)
  }catch(err){
    res.status(500).send({error: err.message})
  }
})

/**
 * GET /feedback
 * Retrieve all feedbacks with optional filters, sorting, and pagination
 * Supported query params: status, limit, skip, sortBy, order
 */
feedbackRouter.get("/feedback", auth, async (req, res) => {
  try{

    const match = {}
    if(req.query.status){
      match.status = req.query.status
    }
    const limit = parseInt(req.query.limit) || 10;   // Default 10
    const skip = parseInt(req.query.skip) || 0;      // Default 0
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;
    const feedback = await Feedback.find({...match})
        .sort({ [sortBy]: order })
        .limit(limit)
        .skip(skip);
    res.send(feedback)
  }catch(err){
    res.status(500).send({error: err.message})

  }
})

/**
 * GET /feedback/:id
 * Retrieve a single feedback entry by ID
 */
feedbackRouter.get("/feedback/:id", auth, async (req, res) => {
  const {id} = req.params
  try{
    const feedback = await Feedback.findById(id)
    if(!feedback){
      return res.status(404).send({error: "Feedback not found."})
    }
    res.send(feedback)

  }catch(err){
    res.status(500).send({error: err.message})
  }


})


/**
 * PATCH /feedback/:id
 * Update feedback fields (title, description, status) if owned by the user
 */
feedbackRouter.patch("/feedback/:id", auth, async (req, res) => {
  try{
    const allowedOperations = ["title", "description", "status"];
    const requestedUpdates = Object.keys(req.body)
    if (requestedUpdates.length === 0) {
      return res.status(400).send({ error: "No fields provided for update." });
    }

    const isOperationAllowed = requestedUpdates.every(operation => allowedOperations.includes(operation) )
    if(!isOperationAllowed){
      return res.status(405).send({error: "Operation not allowed."})
    }
    const {id} = req.params
    const userId = req.user._id;
    const feedback = await Feedback.findOneAndUpdate({_id: id, owner: userId})
    if(!feedback){
      return res.status(404).send({error: "Feedback not found."})
    }

    // apply updates
    requestedUpdates.forEach(update => {
      feedback[update] = req.body[update]
    })
    await feedback.save()

    res.status(200).send(feedback)

  }catch(err){
    res.status(500).send({error: err.message})
  }
})

/**
 * DELETE /feedback/:id
 * Delete a feedback entry owned by the authenticated user
 */
feedbackRouter.delete("/feedback/:id", auth, async (req, res) => {
  try{
    const {id} = req.params
    const userId = req.user._id;
    const feedback = await Feedback.findOneAndDelete({_id: id, owner: userId})
    if(!feedback){
      return res.status(404).send({error: "Feedback not found."})
    }
    res.status(204).end()

  }catch(err){
    res.status(500).send({error: err})
  }
})

// Export the router to be used in the app
export default feedbackRouter;
