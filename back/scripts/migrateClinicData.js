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

async function runMigration() {
  await mongoose.connect(MONGO_URI);

  const activeDoctors = await Doctor.find({ isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  if (!activeDoctors.length) {
    console.log("No active doctors found. No clinic was created.");
    await mongoose.disconnect();
    return;
  }

  const owner = activeDoctors[0];
  let clinic = await Clinic.findOne({ owner_doctor_id: owner._id });

  if (!clinic) {
    clinic = await Clinic.findOne({ name: "Aegis Precision Clinic" });
  }

  if (!clinic) {
    clinic = await Clinic.create({
      name: "Aegis Precision Clinic",
      license_number: "MOH-CLN-88319",
      slot_duration_minutes: 15,
      currency: "USD",
      tax_note: "Zero-Rated Clinical Tax",
      working_hours: defaultWorkingHours,
      owner_doctor_id: owner._id,
    });
  }

  await Doctor.updateMany(
    { isActive: true },
    { $set: { clinic: clinic._id } }
  );
  await User.updateMany(
    { role: "receptionist", isActive: true },
    { $set: { clinic: clinic._id } }
  );
  await DoctorAssignment.updateMany(
    { isActive: true },
    { $set: { clinic: clinic._id } }
  );

  console.log(
    `Clinic migration complete: ${clinic.name}, owner doctor ${owner._id}`
  );
  await mongoose.disconnect();
}

async function rollbackMigration() {
  await mongoose.connect(MONGO_URI);

  await Doctor.updateMany({}, { $set: { clinic: null } });
  await User.updateMany({}, { $set: { clinic: null } });
  await DoctorAssignment.updateMany({}, { $set: { clinic: null } });
  await Clinic.deleteMany({
    name: "Aegis Precision Clinic",
    license_number: "MOH-CLN-88319",
  });

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

module.exports = { runMigration, rollbackMigration };
