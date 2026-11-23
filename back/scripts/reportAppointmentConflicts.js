require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const ACTIVE = ["scheduled", "confirmed", "checked_in", "in_progress"];
const overlaps = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && aEnd > bStart;

async function runReport() {
  await mongoose.connect(MONGO_URI);
  const appointments = await Appointment.find({
    status: { $in: ACTIVE },
  }).populate("patient", "firstName lastName").populate("doctor", "user");

  const report = [];

  for (let i = 0; i < appointments.length; i += 1) {
    const a = appointments[i];
    const aStart = new Date(a.appointmentDate);
    const aEnd = new Date(aStart.getTime() + (a.duration || 30) * 60 * 1000);

    for (let j = i + 1; j < appointments.length; j += 1) {
      const b = appointments[j];
      if (!b.doctor || !a.doctor) continue;
      const sameDoctor = a.doctor._id.toString() === b.doctor._id.toString();
      const samePatient = a.patient?._id?.toString() === b.patient?._id?.toString();
      if (!sameDoctor && !samePatient) continue;

      const bStart = new Date(b.appointmentDate);
      const bEnd = new Date(bStart.getTime() + (b.duration || 30) * 60 * 1000);
      if (overlaps(aStart, aEnd, bStart, bEnd)) {
        report.push({
          type: sameDoctor ? "DOCTOR_APPOINTMENT_OVERLAP" : "PATIENT_APPOINTMENT_OVERLAP",
          appointmentIds: [a._id, b._id],
          doctorIds: [a.doctor._id, b.doctor._id],
          patientIds: [a.patient?._id, b.patient?._id],
          interval: [aStart, bStart],
        });
      }
    }
  }

  const visits = await Visit.find({ status: "in_progress" })
    .populate("appointment", "appointmentDate duration");

  for (const visit of visits) {
    const visitStart = new Date(visit.startedAt || visit.createdAt);
    const linked = visit.appointment;
    const expectedEnd = linked
      ? new Date(
          new Date(linked.appointmentDate).getTime() +
            (linked.duration || 30) * 60 * 1000
        )
      : new Date(visitStart.getTime() + 30 * 60 * 1000);

    const overlappingAppointments = await Appointment.find({
      doctor: visit.doctor,
      status: { $in: ACTIVE },
      appointmentDate: { $lt: new Date(Math.max(expectedEnd.getTime(), Date.now())) },
    });

    for (const appointment of overlappingAppointments) {
      const appointmentStart = new Date(appointment.appointmentDate);
      const appointmentEnd = new Date(
        appointmentStart.getTime() + (appointment.duration || 30) * 60 * 1000
      );
      if (
        appointment._id.toString() !== linked?._id?.toString() &&
        overlaps(
          visitStart,
          new Date(Math.max(expectedEnd.getTime(), Date.now())),
          appointmentStart,
          appointmentEnd
        )
      ) {
        report.push({
          type: "VISIT_APPOINTMENT_OVERLAP",
          visitId: visit._id,
          appointmentId: appointment._id,
          doctorId: visit.doctor,
          patientId: visit.patient,
        });
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  return report;
}

if (require.main === module) {
  runReport().catch((error) => {
    console.error("Appointment conflict report failed:", error);
    process.exit(1);
  });
}

module.exports = { runReport };
