// Import required modules and dependencies
import express from "express"
import dotenv from "dotenv/config"
import cors from "cors"
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// Import app-specific modules
import { connectDB } from "./config/mongoDB.js"
import userRouter from "./routes/user.routes.js"
import feedbackRouter from "./routes/feedback.routes.js"
import fileRouter from "./routes/file.routes.js"
import paymentRouter from "./routes/payment.routes.js";

// Initialize Express app
const app = express()
app.use(cors())

const PORT = Number(process.env.PORT) || 3000

// Load Swagger API documentation
const swaggerDocument = YAML.load('./docs/api-spec.yaml');

// Connect to the MongoDB
connectDB()

// JSON body parser with exception for Stripe webhook
const jsonParser = express.json();
app.use((req, res, next) => {
  // Skip JSON parsing only for the webhook endpoint
  if (req.originalUrl === "/billing/webhook") return next();
  return jsonParser(req, res, next);
});

// Serve Swagger API docs at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check endpoint
app.get('/', (req, res) => {
    return res.status(200).json({msg: "Api is LIVE!!"})
})

// Register route handlers
app.use(userRouter)
app.use(feedbackRouter)
app.use(fileRouter)
app.use(paymentRouter)

// Start the Express server
app.listen(PORT, () => {
  console.log("Server running on port:", PORT)
})
