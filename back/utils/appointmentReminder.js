const CLINIC_TIMEZONE = "Africa/Cairo";

const formatAppointmentReminder = ({ patient, doctor, appointmentDate }) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  const formattedDate = new Intl.DateTimeFormat("en", {
    timeZone: CLINIC_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(appointmentDate);

  return `Reminder: ${patientName} has an appointment with Dr. ${doctorName} on ${formattedDate}.`;
};

module.exports = { formatAppointmentReminder };
