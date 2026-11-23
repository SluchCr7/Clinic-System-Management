# Appointment Conflict Prevention Plan

## Decisions

- MongoDB transactions and atomic doctor locks are used because tests use a replica set and the backend already uses transactions.
- A central availability service will be the only place that determines doctor/patient availability.
- No override is enabled. Admin/doctor/receptionist authorization remains, but conflicts are always enforced.
- The visit model remains appointment-linked. Direct walk-in visit creation is not exposed because the current system is based on checked-in appointments.
- If an appointment is overdue or a visit extends past the expected appointment interval, the doctor remains busy through `now`.
- Day/time representation remains UTC in MongoDB and `Africa/Cairo` for schedule interpretation.
- A no-override policy avoids adding audit fields that are not required.
- The existing doctor booking version remains as a transaction-level serialization signal, while new checks are central and shared with visits.

## 1. Central Availability Service

Create `back/utils/doctorAvailability.js` with:

- `checkDoctorAvailability({doctorId,start,end,excludeAppointmentId,excludeVisitId,patientId,session})`
- returns `available`, `conflicts`, and up to three `nextAvailableSlots`

Conflict types:

- `VISIT`
- `APPOINTMENT`
- `PATIENT_APPOINTMENT`
- `PATIENT_VISIT`
- `OUT_OF_HOURS`
- `BREAK`

It will:

1. Normalize requested start/end.
2. Validate patient and doctor appointment overlap.
3. Read active doctor appointments:
   - `scheduled`
   - `confirmed`
   - `checked_in`
   - `in_progress`
4. Read in-progress visits for the doctor.
5. Calculate visit busy interval:
   - start = `startedAt`
   - end = max(appointment end, now)
6. Exclude the appointment/visit's own references where requested.
7. Read schedule and optional clinic working hours.
8. Return privacy-safe conflict details without patient clinical notes.

## 2. MongoDB Concurrency

Use both:

1. replica-set transaction around each appointment create/update.
2. atomic `Doctor.appointmentBookingVersion` increment before conflict checks.
3. visit-start transaction with the same doctor lock increment.
4. final availability check under the transaction before saving.

The lock is a serialization hint, not a permanent reservation; transactions and query checks ensure the slot decision is authoritative.

For stronger slot protection, add a partial unique reservation collection/index only if transaction replay tests expose remaining races. The current plan can document the existing versioned transaction path because test setup is a replica set.

## 3. Backend Entry Points

Refactor:

- appointment create
- appointment reschedule
- appointment duration update
- appointment status changes that place an appointment back into active use
- visit start
- doctor availability endpoint

Add:

- `GET /api/doctors/:id/availability?date=YYYY-MM-DD&duration=30`
- `GET /api/appointments/availability?doctor=&patient=&date=&duration=` optional route alias if needed

Appointment and visit errors will use:

- `409`
- `DOCTOR_BUSY`
- `PATIENT_DOUBLE_BOOKED`
- `OUTSIDE_WORKING_HOURS`
- `BREAK_TIME_CONFLICT`
- structured `conflicts`
- `nextAvailableSlots`

## 4. Patient Conflict

Check active appointments and in-progress visits for the same patient across every doctor. Exclude the current appointment/visit so same-visit/patient rescheduling does not conflict with itself.

## 5. Visit Start

Before creating a visit:

- lock the doctor
- verify no in-progress visit for that doctor
- verify appointment status is `checked_in`
- verify appointment/visit consistency

If a nearby appointment for another patient exists within the warning window, send a doctor-only warning notification. The default warning window is 15 minutes; record it as a clinic setting placeholder in changelog.

## 6. Late Visit Notifications

Add a bounded Node Cron worker or appointment reminder extension:

- find in-progress visits
- calculate expected end from linked appointment
- detect first time the visit is beyond the appointment end
- notify the doctor and assigned receptionists
- use dedupe event keys
- run once per in-progress visit state

No notification is sent from repeated status updates. A notification is not sent for the same patient again until a new visit starts.

## 7. Frontend

- add doctor/date/duration selection and refetch available slots
- poll or refresh availability every 60 seconds
- disable unavailable slots and show privacy-safe "مشغول"
- keep booking form values on conflict
- show next three alternative slots with one-click fill
- show in-progress visit as busy in agenda
- translate all scheduling errors and alternatives

## 8. Migrations/Indexes

Add a script `migrateAppointmentScheduling.js` that only reports legacy conflicts and creates indexes. It will not mutate legacy data.

Indexes:

- `{doctor:1, appointmentDate:1, duration:1, status:1}`
- `{patient:1, appointmentDate:1, duration:1, status:1}`
- `{doctor:1, status:1, startedAt:1}`
- `{patient:1, status:1, startedAt:1}`
- notification index remains recipient/read/created.

## 9. Tests

Add integration/unit coverage for:

- doctor/partial/full/adjacent appointment conflicts
- patient conflict
- rescheduling and own-exclusion
- cancellation/no-show release
- visit-start conflict
- overdue visit busy interval
- availability endpoint
- concurrent 10-create stress test
- assigned notification recipients/dedupe

## 10. Seed and Report

- extend test fixtures with one in-progress visit and overlapping/adjacent appointments
- add `scripts/reportAppointmentConflicts.js`
- report doctor appointment overlap, patient overlap, and in-progress visit overlaps
