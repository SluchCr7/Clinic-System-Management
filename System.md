# Clinic Management System

## Purpose and scope

This guide describes the clinic's operational workflow as implemented by the
backend: account provisioning, sign-in, patient registration, scheduling,
clinical care, service capture, invoicing, and payment. It also records the
main API routes, role boundaries, validation rules, and persistence behavior so
that operational procedures match the system.

The backend is an Express 5 API backed by MongoDB and Mongoose. The frontend
calls API routes under `/api`. The system stores clinical and financial records
as linked documents rather than one large encounter record.

## Roles and responsibility

The `User` role is one of:

| Role | Typical operational responsibilities |
| --- | --- |
| `admin` | Provision users and doctor profiles; configure schedules and the medical-service catalog; manage patients, clinical records, invoices, payments, and system settings. |
| `receptionist` | Register and update patients; book and manage appointments; upload patient documents; create invoices and record payments. |
| `doctor` | Manage their own schedule and appointments; create and update visits, prescriptions, lab orders, and performed services for their own patients. |

Routes enforce roles with authentication and authorization middleware. Several
services additionally scope doctor queries and mutations to the authenticated
doctor's `Doctor` profile. A doctor must have that profile for doctor-scoped
operations.

## 1. Prepare the clinic and provision accounts

### Configure and start the backend

Configure `back/.env` with at least `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, and `MONGO_URI` for a non-test environment. Common
deployment settings include `PORT`, `FRONTEND_URL`, and the Cloudinary
credentials used for uploaded files. The server connects to MongoDB before it
starts accepting connections. `GET /health` returns HTTP 200 only when the
database connection is ready; otherwise it returns HTTP 503.

Invoice and payment processing use MongoDB multi-document transactions. The
MongoDB deployment must support transactions (normally a replica set or
compatible Atlas deployment).

### Create staff and doctor login accounts

There is no public user-registration endpoint. An initial administrator must
be provisioned through the deployment's approved administrative/bootstrap
process. After an administrator can sign in, only an administrator can create
and manage other user accounts.

Create a staff account with `POST /api/users`, using `role: "receptionist"`.
Create a doctor's login account the same way, using `role: "doctor"`. The
request requires first name, last name, email, password, phone, and role. Email
is normalized to lowercase and must be unique; the password must be at least
eight characters. The backend hashes the password with bcrypt before saving
the user and does not return the password in the response.

A doctor's user account is not yet a clinical doctor profile. After creating
the account, create its profile with `POST /api/doctors`, supplying the user
ID, specialization, license number, and consultation fee. Doctor profiles
require an active user whose role is `doctor`; one user can have only one
doctor profile, and license numbers are unique. Set the consultation fee
before billing because it becomes an invoice line item.

Relevant routes:

| Operation | Endpoint | Who can perform it |
| --- | --- | --- |
| Create/list/get/update/deactivate users | `/api/users` and `/api/users/:id` | Admin |
| Create/list/get/update/deactivate doctor profiles | `/api/doctors` and `/api/doctors/:id` | Admin creates/updates/deactivates; active doctor, receptionist, and admin can read |
| Create/update/deactivate a medical service | `/api/medical-services` and `/api/medical-services/:id` | Admin |

Medical services form the price catalog used when recording performed
services. Configure each service's name, unique code, category, price, and
optional duration before staff need to bill for it.

### Configure doctor availability

Create schedules through `POST /api/schedules`. A schedule specifies a doctor,
day of week (`0` Sunday through `6` Saturday), working start/end times, and
optional break times. Start must be before end; break start and end must either
both be provided or both omitted, and a break must be inside working hours.
Only one schedule per doctor per weekday is allowed. An administrator can set
up a doctor's schedule, and a doctor can manage their own.

## 2. Sign in and establish an authenticated session

Sign in with `POST /api/auth/login` using email and password. On success, the
API returns the user's basic identity and role and sets `accessToken` and
`refreshToken` as HttpOnly cookies. The access token lasts 15 minutes and the
refresh token lasts 7 days by default. Refreshing uses
`POST /api/auth/refresh`; the backend rotates refresh tokens. Use
`GET /api/auth/me` to retrieve the signed-in user's profile, and
`POST /api/auth/logout` to end the session and clear cookies.

Tokens are signed with separate access- and refresh-token secrets. In
production, cookies use `Secure` and `SameSite=None`; non-production cookies
use `SameSite=Lax`. Changing a password uses
`PATCH /api/auth/change-password` and requires the current password; the
service invalidates existing sessions so the user signs in again.

## 3. Register or find the patient

Reception or an administrator registers a patient with `POST /api/patients`.
The required identity fields are first name, last name, date of birth, gender,
and phone. The record can also hold email, address, emergency contact, blood
type, allergies, and chronic diseases. Phone is unique; a non-empty email must
also be unique. New patients are active by default and the creating user is
recorded.

Before creating an appointment, search existing patients with
`GET /api/patients` to avoid duplicate records. Patient lists are paginated,
searchable by name, phone, and email, and default to active patients. Update a
record with `PATCH /api/patients/:id`; deactivation is a soft deactivation,
not a hard deletion. Inactive patients cannot be used for new appointments,
visits, or payments.

Doctors can read only patients linked to one of their appointments or visits.
Patient creation and editing are restricted to administrators and reception
staff.

## 4. Book and manage an appointment

Reception or an administrator books an appointment with
`POST /api/appointments`, supplying the patient ID, doctor profile ID,
appointment date, and duration. Duration defaults to 30 minutes and must be
between 5 and 240 minutes.

On creation, the backend verifies that:

1. The patient and doctor exist and are active.
2. The doctor has an active schedule for that weekday.
3. The appointment fits the doctor's working hours and does not overlap the
   configured break.
4. The requested time does not overlap another non-cancelled/non-no-show
   appointment for that doctor.
5. If this is a follow-up, the referenced visit/appointment belongs to the
   same patient and doctor and an equivalent follow-up has not already been
   booked.
6. The appointment is in the future.

Appointment time and schedule calculations use the clinic timezone
`Africa/Cairo`. The appointment and its audit entry are created in a database
transaction with doctor-booking serialization to reduce conflicting bookings.

The lifecycle status values are `scheduled`, `confirmed`, `checked_in`,
`in_progress`, `completed`, `cancelled`, and `no-show`. Allowed progressions
are:

| Current status | Allowed next status |
| --- | --- |
| `scheduled` | `confirmed`, `checked_in`, `cancelled`, `no-show` |
| `confirmed` | `checked_in`, `in_progress`, `cancelled`, `no-show` |
| `checked_in` | `in_progress`, `cancelled`, `no-show` |
| `in_progress` | `completed`, `cancelled` |
| `completed`, `cancelled`, `no-show` | No further status transition |

The API also applies role-specific status permissions. Receptionists can
confirm, check in, cancel, or mark no-show; doctors can move their own
appointments into care, complete them, or cancel; administrators have the
broader operational status permissions. A cancellation requires a reason.
Rescheduling rechecks the schedule and conflicts and resets the reminder flag.

## 5. Conduct and record the visit

An administrator or doctor creates the encounter using
`POST /api/visits`. The request links an appointment, patient, and doctor and
includes a required chief complaint. It can also include symptoms, vitals,
examination, diagnosis, doctor notes, and a follow-up date.

The service verifies that the patient and doctor are active, the appointment
belongs to both, and the appointment is in `scheduled`, `confirmed`, or
`checked_in` status. A doctor can create a visit only for their own doctor
profile. One visit is allowed per appointment. Visit creation and the linked
appointment update are transactional: the appointment becomes `completed`,
and the visit and audit record are committed together.

Update clinical findings with `PATCH /api/visits/:id`. Doctors can update only
their own visits. A visit links the patient's clinical record, the doctor, and
the originating appointment; this linkage is used by prescriptions,
performed-service entries, follow-ups, and invoices.

### Optional clinical work within the visit

These actions enrich the patient's care record but are separate from invoice
creation:

- **Prescription:** Create with `POST /api/prescriptions`, linking the visit,
  patient, and doctor and providing one or more medications (name, dosage,
  frequency, duration, route, and optional instructions). The backend checks
  the links and permits one prescription per visit. Administrators and
  doctors can create/update; doctors are limited to their own records.
- **Lab order:** Create with `POST /api/lab-orders`, linked to the visit,
  patient, and doctor and containing at least one test. Priority is `routine`,
  `urgent`, or `stat`. Statuses are `ordered`, `sample_collected`,
  `processing`, `completed`, and `cancelled`; the workflow supports
  `ordered` to `sample_collected`, `completed`, or `cancelled`,
  `sample_collected` to `processing` or `cancelled`, and `processing` to
  `completed` or `cancelled`. Completed and cancelled orders are finalized.
- **Medical attachments:** Upload using `POST /api/medical-attachments` as
  multipart form data with the file field `file`, a patient ID, and optional
  visit ID plus type/title/description metadata. The patient must be active;
  if a visit is specified, it must belong to that patient. The backend accepts
  image/PDF signatures, uploads the file to Cloudinary, stores file metadata
  and the audit entry transactionally, and attempts to remove the uploaded
  object if database persistence fails. All three roles can upload; only an
  administrator can delete attachments.
- **Follow-up:** If the clinician records a follow-up date, reception can book
  a future appointment with the originating visit and/or source appointment
  references. The backend checks that those records match the same patient
  and doctor and prevents duplicate follow-ups.

## 6. Record billable services

Before an invoice is created, an administrator or doctor records each
billable service performed using `POST /api/performed-services`, linking the
visit, patient, doctor, and active medical-service catalog entry. Quantity
defaults to one; discounts cannot exceed price multiplied by quantity. The
service name, code, and price are copied into the performed-service record so
the performed item retains its recorded price.

Only administrators and doctors can create/update performed services. Doctors
can record services only for their own visits. Once an invoice exists for a
visit, billable services for that visit cannot be added or modified. Therefore
review the service entries before generating the invoice.

Lab orders are tracked by the lab-order module and are not automatically
included in invoice calculations. Invoice items are built from the doctor's
consultation fee and `PerformedService` entries. If lab work is billable in a
clinic's process, it must be represented by an appropriate configured
billable service and performed-service entry before the invoice is generated.

## 7. Generate and review the invoice

Reception or an administrator can list billable visits with
`GET /api/invoices/eligible-visits`. A visit is eligible when its linked
appointment is completed, its patient and doctor are active, and it has no
existing invoice.

Create the invoice with `POST /api/invoices`, supplying the visit ID and
optional fixed discount, tax amount, and notes. The backend verifies the visit
and appointment link, active patient and doctor, and a valid non-negative
consultation fee. It allows only one invoice per visit.

The backend builds an immutable invoice snapshot of its line items:

- One consultation item using the doctor's consultation fee.
- One item for each valid performed service, using its recorded unit price,
  quantity, and line discount.

Amounts are rounded to two decimal places. The calculation is:

```text
line total = (unit price × quantity) − line discount
subtotal   = sum of line totals
invoice total = subtotal − invoice discount + tax amount
remaining amount = invoice total − paid amount
```

The invoice discount cannot exceed the subtotal. The `tax` field is an amount
added to the subtotal after discount; it is not a percentage rate. The initial
status is `unpaid`, or `paid` if the invoice total is zero. The invoice number,
invoice document, and audit record are created in a MongoDB transaction.
Unique indexes enforce one invoice per visit and a unique invoice number.

Administrators can update invoice discount, tax, and notes using
`PATCH /api/invoices/:id`. Financial amounts cannot be changed after any
payment has been recorded. Administrators or receptionists can cancel an
invoice only if it has no payment; an invoice with payments cannot be cancelled
directly.

## 8. Receive and record payment

Reception or an administrator records a payment with `POST /api/payments`,
providing the invoice ID, a positive amount (up to two decimal places), and
payment method. Supported methods are `cash`, `card`, `bank_transfer`,
`online`, and `insurance`. Card, bank-transfer, and online payments require a
transaction reference. The payment date cannot be in the future.

The backend rejects payment against a cancelled or already-paid invoice and
rejects an amount greater than the current outstanding balance. Inside a
MongoDB transaction it:

1. Validates the invoice and its active patient.
2. Atomically decreases the outstanding balance and increases paid amount,
   guarding against concurrent payment attempts that would overpay.
3. Recalculates invoice status: `unpaid` when nothing has been paid,
   `partially_paid` when a balance remains after a payment, and `paid` when the
   remaining amount reaches zero.
4. Creates the payment record and its audit entry.
5. Commits all changes together, or rolls them all back if any operation
   fails.

Multiple partial payments are supported until the invoice is fully paid. The
payments API records the selected method and transaction reference in the
clinic's ledger; the backend payment service does not itself call an external
card processor or insurance service.

## 9. Operational records and review

The system records audit events for important operations, including
authentication, account and profile changes, patient creation/update,
appointments, visits, prescriptions, performed services, lab orders,
attachments, invoices, and payments. Records generally include timestamps,
creator/updater references, and Mongoose-managed `createdAt`/`updatedAt`
fields. Audit events can be reviewed through `/api/audit-logs`, subject to
authorization.

Admins and staff can review appointment, invoice, and payment lists. Doctors'
clinical and financial queries are scoped to the doctor's records where
implemented. Lists use validated filters, sorting, and pagination; the
dashboard and reports are available under `/api/dashboard`.

## Backend API route map

All paths below are relative to `/api`:

| Domain | Main routes |
| --- | --- |
| Authentication | `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/change-password` |
| Users and doctors | `/users`, `/doctors` |
| Patients and schedules | `/patients`, `/schedules` |
| Appointments and visits | `/appointments`, `/visits` (`/visites` is a backwards-compatible alias) |
| Clinical records | `/prescriptions`, `/lab-orders`, `/medical-attachments` |
| Services and billing | `/medical-services`, `/performed-services`, `/invoices`, `/payments` |
| Operations | `/notifications`, `/audit-logs`, `/dashboard`, `/search` |

Requests are validated with Joi schemas before reaching controllers. Unknown
body/query fields are stripped; validation errors return HTTP 400 with a
`VALIDATION_ERROR` code. Most successful endpoints return JSON with
`success: true` and a `data` field; collection endpoints also provide
pagination metadata. Errors use HTTP status codes and stable error codes
(including authorization, validation, not-found, and workflow-conflict codes).

## Security and operational notes

- Express applies Helmet security headers, configured-origin CORS,
  authentication-specific and general API rate limits, request IDs, body
  parsing limits, sanitization, and HTTP parameter pollution protection.
- Login and refresh credentials are held in HttpOnly cookies; secrets belong
  in deployment environment variables, never source control.
- Deactivating a user or changing their role invalidates active refresh-token
  sessions. The last active administrator cannot be deactivated or reassigned.
- Patient, doctor, visit, and invoice relationships are checked in service
  logic in addition to request-schema validation.
- Keep the MongoDB transaction capability enabled: appointment booking,
  visit completion, invoice creation, and payment recording rely on
  transaction support for consistent multi-document changes.
- The backend's configured port is `PORT` when supplied and otherwise `5000`;
  local documentation commonly sets `PORT=3001`. The frontend API base URL
  should point to the deployed backend's `/api` path.
