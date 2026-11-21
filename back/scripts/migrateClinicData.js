require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const Clinic = require("../modules/Clinic/clinic.model");
const Doctor = require("../modules/Doctor/doctor.model");
const User = require("../modules/User/user.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const defaultWorkingHours = {
  sunday: { open: null, close: null, closed: false, emergency: true },
  monday: { open: "08:00", close: "18:00", closed: false, emergency: false },
  tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
  wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
  thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
  friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
  saturday: { open: "09:00", close: "14:00", closed: false, emergency: false },
};

async function ensureOwnClinicForDoctor(doctor) {
  let clinic = await Clinic.findOne({ owner_doctor_id: doctor._id });
  if (!clinic) {
    const doctorUser = await User.findById(doctor.user).lean();
    const doctorName =
      `${doctorUser?.firstName || ""} ${doctorUser?.lastName || ""}`.trim();
    clinic = await Clinic.create({
      name: `عيادة د. ${doctorName}`,
      license_number: null,
      slot_duration_minutes: 15,
      currency: "USD",
      tax_note: null,
      working_hours: defaultWorkingHours,
      owner_doctor_id: doctor._id,
      isActive: doctor.isActive,
    });
  }

  await Doctor.updateOne(
    { _id: doctor._id },
    { $set: { clinic: clinic._id } }
  );
  return clinic;
}

async function runMigration() {
  await mongoose.connect(MONGO_URI);

  const doctors = await Doctor.find({})
    .sort({ createdAt: 1 })
    .lean();

  if (!doctors.length) {
    console.log("No doctors found. No clinic was created.");
    await mongoose.disconnect();
    return;
  }

  const legacyClinic = await Clinic.findOne({ name: "Aegis Precision Clinic" });
  let legacyOwnerId = legacyClinic?.owner_doctor_id || null;

  if (!legacyOwnerId) {
    legacyOwnerId = doctors[0]._id;
  }

  if (legacyClinic) {
    if (!legacyClinic.owner_doctor_id) {
      legacyClinic.owner_doctor_id = legacyOwnerId;
      await legacyClinic.save();
    }
  }

  let legacyOwner;
  if (legacyClinic) {
    legacyOwner = await Doctor.findById(legacyOwnerId).lean();
  }

  if (legacyClinic && legacyOwner) {
    await Doctor.updateOne(
      { _id: legacyOwner._id },
      { $set: { clinic: legacyClinic._id } }
    );
  }

  for (const doctor of doctors) {
    if (legacyClinic && doctor._id.toString() === legacyOwnerId.toString()) {
      continue;
    }
    await ensureOwnClinicForDoctor(doctor);
  }

  const assignments = await DoctorAssignment.find({ isActive: true }).lean();
  for (const assignment of assignments) {
    const doctor = await Doctor.findById(assignment.doctor).select("clinic").lean();
    if (doctor?.clinic) {
      await DoctorAssignment.updateOne(
        { _id: assignment._id },
        { $set: { clinic: doctor.clinic } }
      );
    }
  }

  const receptionists = await User.find({ role: "receptionist", isActive: true }).lean();
  for (const receptionist of receptionists) {
    const assignment = await DoctorAssignment.findOne({
      receptionist: receptionist._id,
      isActive: true,
    }).lean();
    if (assignment?.clinic) {
      await User.updateOne(
        { _id: receptionist._id },
        { $set: { clinic: assignment.clinic } }
      );
    }
  }

  console.log(
    `Clinic migration complete: ${doctors.length} doctors processed`
  );
  await mongoose.disconnect();
}

async function rollbackMigration() {
  await mongoose.connect(MONGO_URI);

  await Doctor.updateMany({}, { $set: { clinic: null } });
  await User.updateMany({}, { $set: { clinic: null } });
  await DoctorAssignment.updateMany({}, { $set: { clinic: null } });
  await Clinic.deleteMany({ name: /^عيادة د\. / });

  console.log("Clinic migration rollback complete.");
  await mongoose.disconnect();
}

if (require.main === module) {
  const command = process.argv.includes("--rollback")
    ? rollbackMigration()
    : runMigration();
  command.catch((error) => {
    console.error("Clinic migration failed:", error);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  rollbackMigration,
  ensureOwnClinicForDoctor,
};
