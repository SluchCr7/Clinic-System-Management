/**
 * Clinic Isolation Data Migration Script
 *
 * This script safely migrates existing single-clinic data into the multi-clinic architecture:
 * 1. Finds all Patients without a `doctor` reference.
 * 2. Infers doctor ownership from existing Appointments, Visits, or Invoices.
 * 3. If no clinical history exists and there is a single active doctor, assigns the patient to that doctor.
 * 4. Ensures all active Receptionists are assigned to active Doctors if no assignments exist.
 * 5. Provides an idempotent, safe execution report.
 *
 * Usage:
 *   node back/scripts/migrateClinicIsolation.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const Patient = require("../modules/Patient/patient.model");
const Doctor = require("../modules/Doctor/doctor.model");
const User = require("../modules/User/user.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const Invoice = require("../modules/Invoice/invoice.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

async function runMigration() {
  console.log("==================================================");
  console.log("Starting Clinic Isolation Migration...");
  console.log(`Connecting to: ${MONGO_URI}`);
  console.log("==================================================");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  const stats = {
    patientsTotal: 0,
    patientsAlreadyAssigned: 0,
    patientsMigratedViaHistory: 0,
    patientsMigratedViaSingleDoctor: 0,
    patientsOrphaned: 0,
    receptionistsChecked: 0,
    assignmentsCreated: 0,
  };

  const activeDoctors = await Doctor.find({ isActive: true }).select("_id user").lean();
  console.log(`Found ${activeDoctors.length} active doctors in the system.`);

  // 1. Migrate Patients
  const patients = await Patient.find({});
  stats.patientsTotal = patients.length;
  console.log(`Found ${stats.patientsTotal} total patients.`);

  for (const patient of patients) {
    if (patient.doctor) {
      stats.patientsAlreadyAssigned += 1;
      continue;
    }

    let resolvedDoctorId = null;

    // Check existing visits
    const visit = await Visit.findOne({ patient: patient._id }).select("doctor").lean();
    if (visit?.doctor) {
      resolvedDoctorId = visit.doctor;
    }

    // Check existing appointments
    if (!resolvedDoctorId) {
      const appt = await Appointment.findOne({ patient: patient._id }).select("doctor").lean();
      if (appt?.doctor) {
        resolvedDoctorId = appt.doctor;
      }
    }

    // Check existing invoices
    if (!resolvedDoctorId) {
      const inv = await Invoice.findOne({ patient: patient._id }).select("doctor").lean();
      if (inv?.doctor) {
        resolvedDoctorId = inv.doctor;
      }
    }

    if (resolvedDoctorId) {
      patient.doctor = resolvedDoctorId;
      await patient.save();
      stats.patientsMigratedViaHistory += 1;
      console.log(`[PATIENT MIGRATED] Patient ${patient._id} (${patient.firstName} ${patient.lastName}) assigned to Doctor ${resolvedDoctorId} via clinical history.`);
    } else if (activeDoctors.length === 1) {
      patient.doctor = activeDoctors[0]._id;
      await patient.save();
      stats.patientsMigratedViaSingleDoctor += 1;
      console.log(`[PATIENT MIGRATED] Patient ${patient._id} assigned to sole active Doctor ${activeDoctors[0]._id}.`);
    } else {
      stats.patientsOrphaned += 1;
      console.warn(`[WARNING: AMBIGUOUS PATIENT] Patient ${patient._id} (${patient.firstName} ${patient.lastName}) has no history and multiple doctors exist. Needs manual assignment.`);
    }
  }

  // 2. Ensure Doctor-Receptionist Assignments exist
  const receptionists = await User.find({ role: "receptionist", isActive: true }).select("_id firstName lastName").lean();
  stats.receptionistsChecked = receptionists.length;
  console.log(`\nFound ${stats.receptionistsChecked} active receptionists.`);

  const adminUser = await User.findOne({ role: "admin", isActive: true }).select("_id").lean();
  const assignedBy = adminUser ? adminUser._id : (receptionists[0] ? receptionists[0]._id : null);

  for (const rec of receptionists) {
    const existingCount = await DoctorAssignment.countDocuments({
      receptionist: rec._id,
      isActive: true,
    });

    if (existingCount === 0 && activeDoctors.length > 0 && assignedBy) {
      // Create initial assignment to active doctors so receptionists are not locked out
      for (const doc of activeDoctors) {
        await DoctorAssignment.findOneAndUpdate(
          { doctor: doc._id, receptionist: rec._id },
          {
            doctor: doc._id,
            receptionist: rec._id,
            assignedBy,
            isActive: true,
            notes: "Automatic initial assignment from migration script",
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        stats.assignmentsCreated += 1;
        console.log(`[ASSIGNMENT CREATED] Receptionist ${rec._id} (${rec.firstName} ${rec.lastName}) assigned to Doctor ${doc._id}.`);
      }
    }
  }

  console.log("\n==================================================");
  console.log("Migration Completed Summary:");
  console.log("--------------------------------------------------");
  console.log(`Total Patients:                    ${stats.patientsTotal}`);
  console.log(`Already Assigned Patients:         ${stats.patientsAlreadyAssigned}`);
  console.log(`Migrated via Clinical History:     ${stats.patientsMigratedViaHistory}`);
  console.log(`Migrated via Single Active Doctor: ${stats.patientsMigratedViaSingleDoctor}`);
  console.log(`Ambiguous / Orphaned Patients:     ${stats.patientsOrphaned}`);
  console.log(`Active Receptionists Evaluated:    ${stats.receptionistsChecked}`);
  console.log(`Initial Assignments Created:       ${stats.assignmentsCreated}`);
  console.log("==================================================");

  await mongoose.disconnect();
  console.log("Database disconnected. Script exiting cleanly.");
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error("Migration failed with error:", err);
    process.exit(1);
  });
}

module.exports = { runMigration };
