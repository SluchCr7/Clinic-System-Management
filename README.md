# Clinic Management System

A full-stack clinic management platform for handling patients, appointments, doctors, billing, records, and operational workflows in a healthcare environment.

This repository is split into two main parts:
- `front/` – Next.js web application for administrators, doctors, and reception staff.
- `back/` – Express.js + MongoDB API that powers the business logic, authentication, and persistence.

## Overview

The system is designed to support a modern medical practice with role-based access control and secure clinical operations. It helps staff manage:

- patient registration and profiles
- doctor and staff access control
- appointment scheduling and visit management
- medical services and performed services
- prescriptions and attachments
- invoices, payments, and financial records
- audit logs and notifications
- dashboard reporting and operational summaries

## Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Redux Toolkit
- Tailwind CSS
- Framer Motion
- Socket.IO client
- i18n support for multilingual UI

### Backend
- Node.js
- Express.js 5
- MongoDB with Mongoose
- JWT authentication and refresh tokens
- Joi validation
- Cloudinary for file uploads
- Multer for medical attachments
- Helmet, CORS, rate limiting, and sanitization middleware
- Socket.IO for real-time updates

## Project Structure

```text
Clinic-Management/
├── back/                 # API server and business logic
├── front/                # Next.js frontend application
├── README.md             # project overview
└── ...
```

## Prerequisites

Before starting the project, make sure you have:

- Node.js 18 or newer
- npm or another package manager
- MongoDB instance or MongoDB Atlas connection
- Cloudinary account for document/image storage
- a browser to access the UI

## Environment Configuration

### Backend
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

### Frontend
Create a `.env.local` file in `front/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_URL_SOCKET=http://localhost:3001
```

## Run the Application

### 1) Install backend dependencies

```bash
cd back
npm install
```

### 2) Start backend server

```bash
cd back
npm run dev
```

The API runs on:

- http://localhost:3001

### 3) Install frontend dependencies

```bash
cd front
npm install
```

### 4) Start frontend development server

```bash
cd front
npm run dev
```

Open the frontend at:

- http://localhost:3000

## Core Features

### Clinical and Patient Management
- patient registration and record tracking
- contact and demographic data handling
- visit history and treatment context

### Scheduling and Appointments
- appointment booking and management
- schedule tracking for doctors and clinics
- appointment status workflows

### Doctor and Staff Workflow
- role-based authentication and authorization
- doctor-scoped access to patient treatment data
- admin and receptionist operational controls

### Billing and Services
- medical services catalog
- performed services tracking
- invoice generation and payment management

### Records and Compliance
- medical attachments and file uploads
- prescription and consultation records
- audit logs for operational history
- notifications for patient or staff events

## Useful Documentation

- [front/README.md](./front/README.md) – frontend setup and structure
- [back/README.md](./back/README.md) – backend setup and module overview

## Notes

- This project is organized as a multi-package app, so install and run dependencies separately in `front/` and `back/`.
- The backend includes authentication, validation, sanitization, file security, and rate limiting to support a safer healthcare workflow.
- For environment-sensitive deployment, use production-safe secrets and do not commit real credentials to source control.
