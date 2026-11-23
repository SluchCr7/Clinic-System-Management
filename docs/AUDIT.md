# AuraClinic System Audit

Date: 2026-11-23

## A. General Architecture

### Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Redux Toolkit, i18next, and Socket.IO client.
- **Backend:** Node.js, Express.js 5, Mongoose 9, MongoDB, Joi, JWT, Cloudinary/Multer, Node Cron, and Socket.IO.
- **Database:** MongoDB. The project does not use a conventional SQL/Prisma migration framework.
- **State management:** Redux Toolkit for authentication and notifications; RTK Query in `front/services/api` for server state.
- **Authentication:** JWT access/refresh tokens, cookie and bearer-token support, active refresh-token tracking, and password-change/token-version checks.
- **Real-time:** Socket.IO rooms by `user:<id>` plus notification polling in the frontend.
- **Testing:** Jest, Supertest, mongodb-memory-server for backend integration tests; Playwright/e2e scripts and frontend build/lint scripts for frontend validation.

### Repository Structure

- `back/modules/*`: domain modules, usually with model, service, controller, route, and validation files.
- `back/middlewares/*`: authentication, authorization, validation, sanitization, upload, and error handling.
- `back/utils/*`: access control, pagination, lifecycle, reminders, and Socket.IO helpers.
- `back/scripts/*`: idempotent operational migrations for clinic isolation and clinic data.
- `back/tests/*`: Jest/Supertest integration suites.
- `front/app/(dashboard)/*`: dashboard routes and pages.
- `front/components/*`: shared layout, UI, visit, and settings components.
- `front/services/api/*`: RTK Query endpoints.
- `front/features/*` and `front/redux/*`: Redux slices and store setup.
- `front/public/locales/{ar,en}/translation.json`: translations.
- `front/types/*`: frontend API/domain types.
- `tests/e2e-workflow.js` and `front/tests/*`: additional workflow/e2e scripts.

### Authentication and RBAC

Roles are `admin`, `doctor`, and `receptionist`. Permissions are centralized in `back/config/permissions.js` and mapped to role arrays. Route authorization combines `protect` middleware with role checks. Some routes and services add owner/workspace checks, especially for doctors and assigned receptionists.

The permission configuration contains a mismatch worth addressing: the frontend and backend call laboratory/attachment operations under several names, and the route implementation is largely role-based rather than permission-driven. It must be normalized during the upgrade.

### Doctor/Receptionist Assignment

A dedicated `DoctorAssignment` model already exists with fields `doctor`, `receptionist`, `clinic`, `assignedBy`, `isActive`, and a unique `{doctor, receptionist}` index. Active assignments are the source for receptionist clinic scope in `back/utils/accessControl.js`. The assignment UI and admin APIs already exist under `/assignments`, so the external-referral notification work can reuse this relationship instead of adding a duplicate field.

### Database and Migration System

MongoDB/Mongoose is schemaless between deployments except for Mongoose schemas and indexes. There is no migrations framework or migration history collection. The repository uses standalone Node scripts:

- `back/scripts/migrateClinicIsolation.js`
- `back/scripts/migrateClinicData.js`
- `back/scripts/migrateClinicIsolation.js --rollback` is supported by the clinic migration script.

The lab-order upgrade needs a new explicit, idempotent, rollback-capable script, with a durable legacy-status backup and logging.

## B. Current Data Model

### Patients

`Patient` stores identity, demographic data, phone/email, blood type, allergies, chronic diseases, address, emergency contact, active state, and `doctor` ownership.

Relationships: belongs to a `Doctor`, is created by a `User`, and is referenced by appointments, visits, prescriptions, lab orders, invoices, payments, and attachments.

### Doctors and Clinics

`Doctor` stores the linked user, clinic, specialization, license, fee, photo, active state, and creator. `Clinic` stores owner and working hours.

`DoctorAssignment` implements Many-to-Many receptionist/doctor access.

### Receptionists

Receptionists are `User` documents with role `receptionist`. Clinic assignment is currently implemented through `DoctorAssignment`, with a denormalized `User.clinic` value used in some UI flows.

### Appointments

`Appointment` is the scheduling entity with patient, doctor, date, duration, reason, status lifecycle, cancellation/reopening fields, reminder state, source visit/appointment relationships, and audit metadata.

### Visits

`Visit` stores appointment, patient, doctor, complaint, symptoms, vitals, examination, diagnosis, doctor notes, follow-up fields, status, completion metadata, and status history.

Current status values are `in_progress` and `completed`. The default in the schema is currently `completed`, although creation explicitly sets `in_progress`. Existing documents without a status are therefore migrated/normalized by Mongoose's default.

### Prescriptions

`Prescription` has a unique visit relationship and one medication array. It stores patient, doctor, general instructions, notes, and creator/updater metadata.

Current validation requires at least one medication. It has no lab/imaging section and does not currently allow a test-only prescription.

### Lab Orders

`LabOrder` is the current external/diagnostic request model, but it is represented as a lab workflow with test lines and old internal-lab statuses:

- `ordered`
- `sample_collected`
- `processing`
- `completed`
- `cancelled`

Fields are `visit`, `patient`, `doctor`, `tests`, `reason`, `priority`, `status`, `notes`, `orderedAt`, `createdBy`, and `updatedBy`.

Indexes exist separately for patient, doctor, visit, and status, but not the requested compound indexes.

### Invoices, Payments, and Performed Services

`Invoice`, `Payment`, `MedicalService`, and `PerformedService` support billing and encounter service lines. Invoice generation is tied to visits and patient/doctor records. The current visit completion code does not emit a receptionist notification or invoice notification.

### Medical Attachments

`MedicalAttachment` stores patient, optional visit, type, title, description, Cloudinary file metadata, and uploader. Supported types include `lab_report`, `xray`, `prescription`, `medical_report`, and `other`.

It can back external-referral result files. A LabOrder can reference a specific attachment ID instead of duplicating file bytes.

### Notifications

`Notification` currently stores recipient, type, title, message, related model/id, event key, read state, and creator. It has a sparse unique `eventKey` index and polling plus Socket.IO delivery.

Missing fields for the target model include actor/entity/priority/link/status-oriented category semantics. The UI does not currently guarantee deep-link handling for every notification. The backend includes a generic admin-only create endpoint and only some generated reminders/creation paths.

### Audit Logs

`AuditLog` stores actor, action, resource, resource ID, details, and request metadata. It is suitable for lab state audit entries and visit events, although it should be supplemented by explicit from/to/reason fields for state transitions if queries require structured history.

## C. Current Workflows

### Visit Workflow

- A doctor starts a visit only after the linked appointment is `checked_in`.
- Visit creation and appointment transition to `in_progress` occur in a transaction.
- The doctor updates the active visit.
- `POST /api/visits/:id/complete` sets the visit and appointment to `completed` in the same transaction.
- Repeated completion requests currently return the existing completed visit without repeating lifecycle actions, but the completion path does not send notifications.

### Lab/External Referral Workflow

- The doctor creates an order during an active visit.
- The current order stores test lines and an internal lab-oriented status.
- Status updates are performed by doctors/admin, with old transitions allowing collection, processing, completion, and cancellation.
- The frontend provides an internal-lab-style status modal and wording.
- Receptionists are currently excluded from lab routes and have no result-received action.
- The existing test suite treats direct completion of an ordered request as valid, which must be replaced.

### Prescription Workflow

- The doctor creates or updates a prescription for an active visit.
- One prescription is unique per visit and requires one or more medications.
- Prescription detail prints medications and general instructions.
- Lab orders are not included in the prescription API response or print template.
- No test-only prescription representation exists, even though result sections can be derived live from lab orders.

### Notification Workflow

- Notifications can be generated through the generic service and appointment reminder worker.
- Notification creation supports an `eventKey` and checks existing key before creating.
- Socket.IO emits `notification:new` after creation.
- Frontend Header and Sidebar poll unread count every minute.
- Notifications page polls every minute and supports read/read-all filters.
- Existing reminder code may notify the doctor and the booking receptionist/creator, but it does not apply the full active-assignment matrix for every event.
- Some notification types and links are not modeled consistently enough for deep navigation.

## D. Gap Analysis

1. **Internal-lab semantics are incorrect for outpatient referrals:** status names, UI wording, sample collection, and processing state do not match the external-facility reality.
2. **No imaging type on LabOrder:** there is no `type = LAB | IMAGING`.
3. **Missing external-referral fields:** no requested/reception metadata, instructions, clinical notes, expected-by date, facility name, performed date, or attachment link.
4. **Result receiving is not receptionist-enabled:** backend permissions and routes exclude receptionists from lab updates.
5. **State transitions are too permissive:** old direct ordered-to-completed transitions and terminal-state behavior violate the new state machine.
6. **No structured status audit:** status changes must record from/to, actor, timestamp, and reason.
7. **Prescription and print do not consume LabOrder data:** adding a lab order after prescription creation cannot automatically appear in the prescription/print unless the print endpoint/component reads the visit's live LabOrders.
8. **Prescription model blocks test-only referrals:** medications are required, although the request can be met by rendering/refetching an external-referral section independently of the medication model.
9. **Patient/visit lab sections contain internal-lab wording and lack some required actions/filters.**
10. **Sidebar and main lab page retain old names and old statuses in both UI and translations.**
11. **Visit completion has no VisitCompleted notification/receptionist routing.**
12. **Notifications lack the requested normalized fields and deep-link data:** actor, entity type/id, link, priority, and complete dedupe semantics need strengthening.
13. **No follow-up-open-order reminder:** existing cron only handles appointments.
14. **Current notification matrix is incomplete:** appointment events, visit check-in, cancellation/result receipt, and assigned-receptionist routing require explicit helpers.
15. **Access control tests exist but receptionist lab access and notification isolation need focused coverage.**
16. **No migration framework or migration history:** scripts are the established closest-fit pattern.
17. **Lab index coverage is insufficient:** a compound status/patient/visit query strategy is missing.
18. **Print template lacks live external-referral sections and Arabic RTL print rules.**
19. **Seed setup uses test fixtures rather than a production seed script; seed data should be updated with a clear scenario and assignment.**
