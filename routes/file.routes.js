// Import necessary libraries
import express from "express"
import { upload , uploadToCloudinary} from "../config/cloudinary.js"

// Create a router for file upload endpoints
const fileRouter = express.Router()

fileRouter.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    res.status(200).json({
      url: result.secure_url,
      //public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export the router to be used in the app
export default fileRouter
