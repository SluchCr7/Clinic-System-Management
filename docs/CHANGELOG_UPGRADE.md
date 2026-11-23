# AuraClinic External Referral Upgrade

## Summary

This upgrade changes diagnostic laboratory and imaging orders from an internal specimen-workflow concept into outpatient external referrals. Existing lab/imaging orders retain their data while legacy statuses are migrated to the new three-state model.

## Data Changes

- Added `LAB` and `IMAGING` request type.
- Replaced `ordered`, `sample_collected`, `processing`, `completed`, and `cancelled` with:
  - `REQUESTED`
  - `RESULT_RECEIVED`
  - `CANCELLED`
- Added request metadata, instructions, clinical notes, expected date, receipt metadata, external facility, result notes, and result attachment.
- Preserved legacy status in `legacyStatus` during migration.
- Added compound LabOrder indexes and notification entity/priority/link fields.
- Prescriptions now support medication-only, medication-plus-referral, and referral-only output; prescription print reads live LabOrders for the visit.

## Migration

Run from `back/`:

```bash
npm run migrate:lab-external-referrals
```

Status mapping:

- `ordered`, `sample_collected`, `processing` -> `REQUESTED`
- `completed` -> `RESULT_RECEIVED`
- `cancelled` -> `CANCELLED`

Rollback:

```bash
npm run rollback:lab-external-referrals
```

The migration is idempotent and restores the saved legacy status. Review migrated records afterward in MongoDB; rollback does not remove newly added referral fields.

## Notification and Assignment Setup

Receptionist routing continues to use the existing `DoctorAssignment` Many-to-Many relationship. Before production use, an administrator should review `/assignments` and ensure each receptionist is assigned only to the doctors they support.

Visit completion sends one notification to assigned receptionists. External-result receipt sends the responsible doctor a notification when a receptionist records it. Doctor cancellation sends notifications to assigned receptionists. Notification dedupe keys prevent retries from creating duplicates.

## UI Changes

- Sidebar/page labels now use "التحاليل والأشعة المطلوبة".
- Removed specimen/sample-processing workflow language from Arabic and English referral screens.
- Added referral type, result receipt, external facility, result file, cancellation reason, and visit links.
- Added live referral sections to prescription detail/print output.
- Added notification deep-link handling and new visit/result/cancellation categories.

## Operations

Run backend tests:

```bash
cd back
npm test
```

Build frontend:

```bash
cd front
npm run build
```

Recommended manual scenario: doctor creates a visit and lab/imaging referrals, adds a prescription, completes the visit, assigned receptionist records result and upload, and confirms the doctor receives one result notification.
