# Appointment Conflict Prevention Changelog

## Summary

Appointment booking and visit start now use a centralized availability service that considers:

- in-progress visits
- active appointments
- patient overlap across doctors
- schedule working hours and breaks
- adjacent half-open intervals

## Data and Database

- added compound indexes for doctor/patient appointment conflict queries
- added doctor/patient in-progress visit indexes
- added migration script: `back/scripts/migrateAppointmentScheduling.js`
- added read-only legacy conflict report: `back/scripts/reportAppointmentConflicts.js`

## API

- appointment create/reschedule/duration changes now reject conflicts with `409`
- visit start now shares the doctor appointment lock and availability check
- doctor availability endpoint:
  `GET /api/doctors/:id/availability?date=YYYY-MM-DD&duration=30`
- conflict responses include `conflicts` and `nextAvailableSlots`

## Frontend

- booking form calls the availability endpoint and refreshes it every minute
- available times can be selected directly
- conflict responses preserve form data and show nearest alternatives
- live polling reduces stale-slot attempts

## Notifications

- starts of visits with a nearby appointment notify the doctor
- overdue in-progress visits notify the doctor and assigned receptionists once through dedupe keys
- no notification is sent for failed booking conflicts

## Decisions Requiring Clinic Review

- no override policy is enabled
- nearby-appointment warning window is 15 minutes
- clinic time zone is `Africa/Cairo`
- default booking duration is 30 minutes
- late visits remain busy until they are completed
- direct walk-in visit creation remains unsupported because the existing visit model requires a checked-in appointment

## Migration and Operations

Create indexes:

```bash
cd back
npm run migrate:appointment-scheduling
```

Review legacy conflicts without changing data:

```bash
cd back
npm run report:appointment-conflicts
```

The report should be reviewed by the clinic owner before resolving historical overlaps manually.
