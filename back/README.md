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

The Jest suite starts a temporary single-node MongoDB replica set, creates a
separate database per test file, clears collections around each test, and
stops the server during global teardown. A replica set is used because invoice
and payment services perform multi-document transactions. The first run may
download the MongoDB binary required by `mongodb-memory-server`.

Integration suites cover authentication and admin user provisioning,
appointments and scheduling conflicts, patient records, invoice calculations,
payment balance/status changes, and appointment reminder delivery.

## Appointment Reminders

The reminder worker starts after MongoDB connects and checks for eligible
appointments once per minute. It sends an in-app notification to the assigned
doctor and the staff member who booked the appointment, then sets
`reminderSent` to `true`. Rescheduling an appointment resets that flag.

Only administrators can read or change the persisted clinic-wide settings:

- `GET /api/notifications/reminder-settings`
- `PATCH /api/notifications/reminder-settings` with
  `{ "enabled": true, "minutesBefore": 120 }`

`minutesBefore` accepts 1–1440 minutes. The admin Settings page exposes common
intervals from one minute to 24 hours. The notification list supports polling
and Socket.IO updates; reading notifications and the unread-count endpoint are
already part of the notifications API. The worker is in-app only; SMS/WhatsApp
delivery can be connected using the shared message formatter in
`utils/appointmentReminder.js`.

### Local reminder test

1. Start the backend and frontend, sign in as an administrator, and open
   **Settings → Clinic**. Enable reminders and set the interval to **1 minute**.
2. In `mongosh`, use existing active patient/doctor/staff records to insert a
   test appointment about three minutes in the future:

   ```javascript
   const patient = db.patients.findOne({ isActive: true });
   const doctor = db.doctors.findOne({ isActive: true });
   const staff = db.users.findOne({ isActive: true, role: "receptionist" });

   const appointmentId = db.appointments.insertOne({
     patient: patient._id,
     doctor: doctor._id,
     createdBy: staff._id,
     appointmentDate: new Date(Date.now() + 3 * 60 * 1000),
     duration: 30,
     status: "scheduled",
     reminderSent: false,
     createdAt: new Date(),
     updatedAt: new Date()
   }).insertedId;
   ```

   Ensure all three lookups returned a document. The inserted appointment ID
   can be retained from the `insertOne` result.
3. The reminder is due about one minute before the inserted appointment. Since
   the worker checks once per minute, allow about one to three minutes after
   inserting it. Verify the flag and notification documents in `mongosh`:

   ```javascript
   db.appointments.findOne({ _id: appointmentId }, { reminderSent: 1 });
   db.notifications.find({
     relatedModel: "Appointment",
     relatedId: appointmentId
   });
   ```

   The worker notifies the assigned doctor and booking staff.
4. In the frontend, open **Notifications** while signed in as either recipient.
   The list refreshes every minute and also receives live Socket.IO updates.
   Confirm the appointment reminder is present and that **Mark as read** and
   the unread count work.

## Notes

- The backend is intentionally strict about validation, authorization, and file upload safety.
- Sensitive secrets should never be committed to source control.
- The frontend app communicates with this service through `NEXT_PUBLIC_API_URL`.

## Related Project Documentation

- [../README.md](../README.md) – full project overview
- [../front/README.md](../front/README.md) – frontend client documentation
