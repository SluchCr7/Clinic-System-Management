require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

async function runMigration() {
  await mongoose.connect(MONGO_URI);
  const appointments = mongoose.connection.collection("appointments");
  const visits = mongoose.connection.collection("visits");

  await appointments.createIndexes([
    { key: { doctor: 1, status: 1, appointmentDate: 1, duration: 1 }, name: "doctor_status_time" },
    { key: { patient: 1, status: 1, appointmentDate: 1, duration: 1 }, name: "patient_status_time" },
  ]);
  await visits.createIndexes([
    { key: { doctor: 1, status: 1, startedAt: 1 }, name: "doctor_visit_status_time" },
    { key: { patient: 1, status: 1, startedAt: 1 }, name: "patient_visit_status_time" },
  ]);

  console.log("Appointment scheduling indexes created. Legacy data was not modified.");
  await mongoose.disconnect();
}

if (require.main === module) {
  runMigration().catch((error) => {
    console.error("Appointment scheduling migration failed:", error);
    process.exit(1);
  });
}

module.exports = { runMigration };
