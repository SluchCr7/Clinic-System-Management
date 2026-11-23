# Implementation Plan

## Decisions

- Keep the existing `LabOrder` model name and API route `/api/lab-orders` for compatibility, while changing the domain behavior and UI labels to external referrals.
- Add `LAB` and `IMAGING` types to the existing model rather than creating a second imaging model.
- Reuse `DoctorAssignment` for receptionist-to-doctor routing and notification recipients.
- Reuse `MedicalAttachment` for result files. A LabOrder will store the selected attachment ID or use an attachment reference field.
- Reuse `AuditLog` plus explicit structured details for state transition history. A dedicated status history subdocument is not necessary if structured audit details are complete and indexed.
- Add notifications inside existing visit/lab transactions where MongoDB transactions are available, using `eventKey`/unique dedupe and assignment lookup. Socket emission remains after persistence.
- Do not create a second stored copy of lab orders in prescriptions. Prescription detail and print data will read LabOrders by `visit`.
- Keep compatibility names in API routes for existing integrations, but remove internal-lab status values and internal-lab wording from the public UI and translations.
- Preserve historical data during migration. The migration script will write a backup status field, update enum values, and support rollback for migrated documents.

## Phase 1: Migration and Schema

1. Add a new script at `back/scripts/migrateLabExternalReferrals.js`.
2. Make it idempotent and transaction-safe where supported.
3. Map legacy statuses:
   - `ordered` -> `REQUESTED`
   - `sample_collected` -> `REQUESTED`
   - `processing` -> `REQUESTED`
   - `completed` -> `RESULT_RECEIVED`
   - `cancelled` -> `CANCELLED`
4. Preserve legacy status in `legacyStatus` and legacy status migration metadata.
5. Add `type`, `requestedAt`, `requestedBy`, `instructions`, `clinicalNotes`, `expectedBy`, receipt fields, facility name, result notes, and result attachment fields.
6. Add compound indexes:
   - `{status: 1, patient: 1, visit: 1}`
   - `{patient: 1, createdAt: -1}`
   - `{doctor: 1, createdAt: -1}`
7. Add notification and assignment indexes.
8. Add npm script `migrate:lab-external-referrals` and rollback flag.

## Phase 2: Backend Domain Rules

1. Replace LabOrder enum/status validation with `REQUESTED`, `RESULT_RECEIVED`, `CANCELLED`.
2. Enforce transitions:
   - `REQUESTED -> RESULT_RECEIVED | CANCELLED`
   - `RESULT_RECEIVED -> REQUESTED` only for admin/doctor, with reason
   - `CANCELLED -> REQUESTED` only for admin
   - reject other transitions with 409/422
3. Allow doctors to create requests and doctors/receptionists/admin to receive/cancel according to the role matrix.
4. Allow receptionists to update only result receipt/cancellation-restricted fields for assigned-doctor orders.
5. Keep all doctor ownership/patient/visit checks on the backend.
6. Normalize API fields as `requestedAt/requestedBy/receivedAt/receivedBy/performedAt/externalFacilityName/resultNotes/resultAttachment/instructions/clinicalNotes/expectedBy/type`.
7. Create a file attachment through the existing medical-attachment service and link the attachment to the LabOrder and visit/patient.
8. Record every status transition in AuditLog with actor, from, to, reason, and timestamps.

## Phase 3: Notifications

1. Extend the Notification model for `entityType`, `entityId`, `link`, `priority`, `actor`, and normalized category values while preserving legacy fields.
2. Add centralized Arabic notification templates and event dedupe keys.
3. Implement active assigned receptionist lookup through `DoctorAssignment`.
4. Generate one visit-completed notification for assigned receptionists only on the actual `in_progress -> completed` transition.
5. Include open lab/imaging count in the visit-completed body and deep link to the invoice/visit/lab view.
6. Generate result-received notifications only when the actor is not the responsible doctor.
7. Generate cancellation notifications to assigned receptionists.
8. Generate appointment event and check-in notifications using existing assignment scope.
9. Add scheduled open-referral follow-up reminders for next-day appointments.
10. Prevent self-notification, deduplicate with a unique event key, and keep notification writes in the operation transaction where supported.

## Phase 4: Prescription and Print

1. Relax the prescription medication validator enough to support test-only prescriptions, while deciding at API/UI orchestration level:
   - medications + orders
   - medications only
   - orders only
2. Update prescription detail/get-by-ID data to include live LabOrders for the visit.
3. Add an external-referral section after medications in the printable prescription.
4. Render only when live orders exist.
5. Add patient, visit date, doctor, follow-up date, numbered test/imaging lines, priority, and instructions.
6. Add the fixed "يُرجى إحضار النتائج في الزيارة القادمة" line.
7. Preserve RTL and A4/A5 print CSS; hide all UI controls.

## Phase 5: Frontend

1. Rename the lab sidebar item and page to "التحاليل والأشعة المطلوبة".
2. Replace internal workflow status options and labels.
3. Redesign the table for patient, visit link, referral type/icon, priority, status, and quick result action.
4. Add status/type/priority/doctor/patient/date filters and a "مطلوب لسه" counter.
5. Replace the status modal with receipt fields and optional file upload.
6. Add cancellation confirmation and clear loading/error/empty states.
7. Update patient and visit pages with the external-referral section and add-request action.
8. Update notification dropdown/page with deep links, read-all, unread filters, and real-time/polling behavior.
9. Remove all visible internal-lab wording from Arabic and English translations.

## Phase 6: Tests

- Lab state transitions: allowed and forbidden transitions, 409 codes, admin/doctor reversals, and cancellation finality.
- Receptionist update isolation and assigned/ unassigned doctor access.
- Result receipt creates attachment link and result metadata.
- Migration: legacy status mapping, idempotence, rollback, and no data loss.
- Visit completion: assigned receptionist receives exactly one notification; unassigned receptionists receive none.
- Dedupe: repeated/retried event creates no duplicate notification.
- No self-notification for receptionist/doctor result actors.
- Prescription: medication+orders, medication-only, and orders-only cases; print data comes from live LabOrders.
- Notification deep links and read/privacy.
- RTL/mobile smoke checks.

## Phase 7: Validation

1. Run backend migrations in a disposable database first.
2. Run backend Jest suite and targeted e2e workflow.
3. Run frontend build and lint.
4. Run Playwright/e2e scenario where available.
5. Document migration commands and manual clinic assignment in the changelog.
