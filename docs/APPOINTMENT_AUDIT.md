# Appointment and Visit Conflict Audit

Date: 2026-11-23

## 1. Actual Stack

The repository uses:

- Frontend: Next.js 16, React 19, TypeScript, Redux Toolkit/RTK Query, i18next, Tailwind CSS.
- Backend: Node.js, Express 5, MongoDB/Mongoose, Joi, JWT, Socket.IO.
- Database: MongoDB replica set in tests; production depends on `MONGO_URI` and should be replica-set/SR transaction capable for the transaction strategy to work.
- Time zone: appointment code normalizes clinic times for `Africa/Cairo`; MongoDB stores JavaScript `Date` values in UTC.

## 2. Appointment Model

`Appointment` fields include:

- `patient`, `doctor`, `appointmentDate`, `duration`
- `status`
- lifecycle timestamps and actors
- `createdBy`, `updatedBy`
- follow-up references and follow-up metadata
- status history and reminder state

Active statuses are currently `scheduled`, `confirmed`, `checked_in`, and `in_progress`. `cancelled`, `completed`, and `no-show` are non-active.

The status lifecycle is centralized in `back/utils/appointmentLifecycle.js`, with role restrictions for some transitions.

## 3. Visit Model and Lifecycle

`Visit` is linked one-to-one in code to an appointment (`appointment` is a unique required reference). It stores:

- actual `startedAt`
- status `in_progress | completed`
- completed metadata
- patient and doctor
- clinical notes and follow-up fields

Only a doctor can create a visit, and only for a checked-in appointment. The same doctor starts it in a transaction together with an appointment transition to `in_progress`.

There is no supported direct/walk-in visit in the backend or frontend; `createVisitSchema` requires `appointment`, `patient`, and `doctor`. The existing UI only exposes checked-in appointments.

## 4. Schedule and Working Hours

Each `Schedule` has one record per doctor/day with:

- `dayOfWeek`
- `startTime`
- `endTime`
- optional break start/end
- active status

The clinic model also has clinic working hours and `slot_duration_minutes`, but appointment validation currently sources the daily `Schedule` as the authoritative schedule.

The frontend passes a local clinic datetime to the backend. Appointment validation normalizes Cairo clinic wall time and converts it to UTC.

## 5. Existing Conflict Behavior

Appointments already run inside MongoDB transactions and attempt to serialize doctor booking changes with an increment on `Doctor.appointmentBookingVersion`.

The existing `validateNoConflict`:

- checks only overlapping appointments for the doctor
- excludes only cancelled and no-show appointments
- has no in-progress visit check
- does not check patient overlap across doctors
- does not return structured conflicts or next slots
- can miss/incomplete old data and race edge cases

Schedule validation checks working hours and breaks before conflict validation.

## 6. Existing Mutation Entry Points

### Appointment creation

- `POST /api/appointments`
- used by administrators, receptionists, and follow-up doctors
- locked through the doctor transaction version increment

### Appointment updates/reschedules

- `PATCH /api/appointments/:id`
- validates reschedule time and doctor conflicts
- excludes the appointment itself
- can change `duration` and status

### Appointment cancellation/no-show

- `DELETE /api/appointments/:id` for receptionists
- status update can transition to `cancelled` or `no-show`

### Visit start

- `POST /api/visits`
- requires a checked-in linked appointment
- changes appointment and visit in the same transaction

### Other mutations

- appointment status transitions use the lifecycle helper
- reminder worker updates reminders
- test/scripts can directly write MongoDB and bypass API validation
- no recurring appointments or recurring booking UI exists

## 7. Concurrent and Transaction Safety

MongoDB test setup uses a one-node replica set and the backend already uses `mongoose.startSession()/withTransaction`.

The existing doctor version increment is a best-effort transaction serialization primitive, but it is not a slot lock, not part of every visit start, and it can be incremented/decremented by unrelated operations. Concurrent operations can therefore still require a central availability check under the same transaction lock and a protected slot model.

## 8. Gap Analysis

1. No in-progress visit is considered by appointment conflict validation.
2. The visit's actual in-progress time is not converted into the doctor busy interval.
3. Overdue visits are not represented explicitly: busy end is `max(expected end, now)`, and must be recalculated dynamically.
4. No patient-wide overlap check exists across doctors.
5. No centralized availability service is used by frontend and backend.
6. No availability endpoint exists.
7. Conflict errors do not provide structured conflict/alternative slot data.
8. Editing doctor on an appointment is not supported by update validation and should remain explicitly blocked unless a migration/API contract adds it.
9. Starting a visit has no check for another in-progress visit for the same doctor.
10. Starting a visit does not reserve a doctor lock shared with appointment creation.
11. Appointment update currently changes doctor only through direct model/data bypass or follows existing appointment; changing doctor must use the centralized service.
12. Existing data is not reported for overlapping appointments or visits.
13. Frontend offers arbitrary datetime input and no live availability list.
14. Frontend conflict handling does not expose alternative slots.
15. No late-visit notification worker exists.
16. Visit completion releases busy time immediately but no delay/late notification transition is currently scheduled.
17. There is no DST/overnight clinic-slot test.
18. Migrations/indexes do not protect slot queries; compound indexes are incomplete.
19. Direct database writes and seed/test writes bypass business rules by design, so an audit script is required and should not silently mutate legacy conflicts.

## 9. Notification Audit

The system has appointment notifications, assigned receptionist lookup, Socket.IO, dedupe keys, and in-app polling. It does not have late-visit or imminent-next-appointment scheduling events. New scheduling notifications must be routed through `DoctorAssignment` and dedupe by event/appointment/recipient.
