# Backend – Clinic Management System

This folder contains the Node.js API that powers the clinic management system. It handles authentication, patient records, scheduling, billing, doctor workflows, notifications, and secure file uploads.

## Tech Stack

- Node.js
- Express.js 5
- MongoDB with Mongoose
- JWT authentication
- Joi validation
- Cloudinary + Multer for file uploads
- Socket.IO
- Helmet, CORS, rate limiting, and sanitization middleware

## Main Responsibilities

- user authentication and role-based authorization
- patient and doctor lifecycle management
- appointment and visit handling
- prescriptions, services, and invoices
- payment processing and billing records
- notifications and audit logs
- medical attachment uploads and validation

## Project Structure

```text
back/
├── config/             # configuration setup
├── middlewares/        # auth, validation, upload, security middleware
├── modules/            # domain modules for users, patients, doctors, etc.
├── tests/              # Jest and Supertest test suite
├── utils/              # shared helper functions and error handling
├── index.js            # API entry point
├── .env                # environment settings
├── package.json
├── jest.config.js
└── README.md
```

## Prerequisites

- Node.js 18+
- MongoDB instance or MongoDB Atlas cluster
- Cloudinary account
- environment variables configured in `.env`

## Environment Setup

Create a `.env` file in `back/` with values similar to:

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
MONGO_URI=your_mongodb_connection_string

JWT_ACCESS_SECRET=replace_with_a_secure_random_value
JWT_REFRESH_SECRET=replace_with_a_secure_random_value
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

CLOUDINARY_NAME=your_cloudinary_name
API_KEY=your_cloudinary_api_key
API_SECRET_KEY=your_cloudinary_api_secret

EMAIL_NAME=your_email_address
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_APP_PASS=your_email_app_password
```

## Install and Run

```bash
cd back
npm install
npm run dev
```

The API listens on:

- http://localhost:3001

## Testing

```bash
cd back
npm test
```

## Notes

- The backend is intentionally strict about validation, authorization, and file upload safety.
- Sensitive secrets should never be committed to source control.
- The frontend app communicates with this service through `NEXT_PUBLIC_API_URL`.

## Related Project Documentation

- [../README.md](../README.md) – full project overview
- [../front/README.md](../front/README.md) – frontend client documentation
