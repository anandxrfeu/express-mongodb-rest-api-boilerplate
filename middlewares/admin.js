// Middleware to allow access only to users with ADMIN role
const isAdmin = async (req, res, next) => {

  // Check if the authenticated user's role is ADMIN
  if (req.user.role === "ADMIN") {
    next(); // Proceed to the next middleware or route handler
  } else {
    // Block access and return 401 Unauthorized
    return res.status(401).send({ error: "You do not have the sufficient privileges." });
  }
}

export default isAdmin;
