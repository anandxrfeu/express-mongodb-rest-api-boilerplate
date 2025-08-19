# REST API Boilerplate

A modular, production-ready **Node.js + Express + MongoDB** backend starter, designed for rapid development of authenticated REST APIs with built-in **Stripe-powered subscription management**.

This boilerplate includes user management, JWT-based authentication, role-based access, email verification, password reset, file uploads via Cloudinary, and subscription billing using Stripe.


## 🧱 Tech Stack

- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **JWT** for authentication
- **Stripe** for subscription payments
- **SendGrid** for transactional emails
- **Cloudinary** for file uploads
- **Multer** for handling file input
- **Swagger (OpenAPI)** for live API docs


## ✅ Features

- User signup, login, logout
- Email verification on registration
- Password reset with token-based flow
- Role-based access control (admin/user)
- Cloudinary-based image upload
- Soft deletion of users
- Feedback module (create, read, update, delete)
- Fully documented via Swagger at `/docs`

## 🔔 Stripe-Specific Features
- Checkout session creation with Stripe
- Support for trials and recurring subscriptions
- Webhook handling for subscription lifecycle events (trial start/end, payment success/failure, cancellation)
- Automatic user isPro flag updates based on subscription status
- Email notifications for trial ending, subscription expiring, and cancellations


## 📫 API Endpoints (Selected)

### 🔐 Auth & User
| Method | Endpoint              | Description                 |
| ------ | --------------------- | --------------------------- |
| POST   | `/signup`             | Register new user           |
| GET    | `/verifyEmail?token=` | Verify email via token      |
| POST   | `/login`              | Log in with email/password  |
| POST   | `/forgotPassword`     | Request password reset link |
| POST   | `/resetPassword`      | Reset password using token  |
| PATCH  | `/user`               | Update profile or password  |

### 🗣 Feedback
| Method | Endpoint    | Description      |
| ------ | ----------- | ---------------- |
| POST   | `/feedback` | Submit feedback  |
| GET    | `/feedback` | Get all feedback |

### 📁 File Upload
| Method | Endpoint       | Description                 |
| ------ | -------------- | --------------------------- |
| POST   | `/file/upload` | Upload a file to Cloudinary |

### 💳 Stripe Billing
| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| POST   | `/billing/create-checkout`  | Create a Stripe Checkout session     |
| POST   | `/billing/webhook`          | Stripe webhook for subscription flow |
| POST   | `/billing/status`           | Get user's status.                   |
| POST   | `/billing/portal`           | Create stripe billing portal session |

## 🧪 Getting Started

1. Clone the repo
   ```sh
   git clone https://github.com/anandxrfeu/express-mongodb-rest-api-boilerplate.git
   ```

2. Install NPM packages
   ```sh
   npm install
   ```

4. Configure environment variables

5. Ensure you have mondo-db running

6. Run locally
   ```sh
   npm run dev
   ```
   Server runs on http://localhost:3000


## 📁 Folder Structure
   ```sh
  ├── config/            # DB, cloudinary, environment config
  ├── docs/api-spec.yaml # OpenAPI spec
  ├── middlewares/       # Auth, admin checks
  ├── models/            # Mongoose schemas (User, Feedback, PaymentEvent)
  ├── routes/            # Express route handlers
  ├── services/          # Email service abstraction
  ├── utils/             # Stateless helpers (string utils)
  ├── app.js             # Main application entry point

   ```


## 🚧 Roadmap
This boilerplate lays the foundation for most user based apps, and is currently functionally generic.
Planned extensions include:
- Add rate limiting middleware
- Implement account lockout on failed logins
- Add tests with Jest or Supertest


## Contact

* Anand Chelvan - [@anandxrfeu](https://twitter.com/anandxrfeu)
