// Import required modules
import express from "express"
import dotenv from "dotenv/config"
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { connectDB } from "./config/mongoDB.js"
import userRouter from "./routes/user.routes.js"
import feedbackRouter from "./routes/feedback.routes.js"
import fileRouter from "./routes/file.routes.js"

const app = express()     // Initialize Express app
const PORT = Number(process.env.PORT) || 3000
const swaggerDocument = YAML.load('./swagger.yaml');

// Connect to the MongoDB database
connectDB()

// Middleware to parse incoming JSON payloads
app.use(express.json())

// Mount the Swagger docs at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
    return res.status(200).json({msg: "Api is LIVE!!"})
})

// Register route handlers
app.use(userRouter)
app.use(feedbackRouter)
app.use(fileRouter)


// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log("Server running on port:", PORT)
})
