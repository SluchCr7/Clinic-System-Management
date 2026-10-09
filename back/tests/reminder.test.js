jest.mock("../modules/Notification/notification.service", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const Appointment = require("../modules/Appointment/appointment.model");
const Doctor = require("../modules/Doctor/doctor.model");
const Notification = require("../modules/Notification/notification.model");
const ReminderSettings = require("../modules/Notification/reminderSettings.model");
const Patient = require("../modules/Patient/patient.model");
const User = require("../modules/User/user.model");
const notificationService = require("../modules/Notification/notification.service");
const { runAppointmentReminders } = require("../utils/reminder");

const createAppointmentFixtures = async (appointmentDate) => {
  const receptionist = await User.create({
    firstName: "Rita",
    lastName: "Reception",
    email: "reception@example.com",
    password: "testpassword",
    role: "receptionist",
  });
  const doctorUser = await User.create({
    firstName: "Dana",
    lastName: "Doctor",
    email: "doctor@example.com",
    password: "testpassword",
    role: "doctor",
  });
  const patient = await Patient.create({
    firstName: "Pat",
    lastName: "Patient",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
    phone: "555-0100",
    createdBy: receptionist._id,
  });
  const doctor = await Doctor.create({
    user: doctorUser._id,
    specialization: "Family Medicine",
    licenseNumber: "DOC-REMINDER-1",
    consultationFee: 50,
    createdBy: receptionist._id,
  });
  const appointment = await Appointment.create({
    patient: patient._id,
    doctor: doctor._id,
    appointmentDate,
    duration: 30,
    status: "scheduled",
    createdBy: receptionist._id,
  });

  return { appointment, receptionist, doctorUser };
};

describe("appointment reminder worker", () => {
  beforeEach(() => {
    notificationService.createNotification.mockClear();
    notificationService.createNotification.mockResolvedValue({});
  });

  it("creates in-app notifications and marks the appointment as reminded", async () => {
    await ReminderSettings.create({
      enabled: true,
      minutesBefore: 1,
      lastCheckedAt: null,
    });
    const { appointment, receptionist, doctorUser } =
      await createAppointmentFixtures(new Date(Date.now() + 90_000));

    const result = await runAppointmentReminders();

    const updatedAppointment = await Appointment.findById(appointment._id);
    expect(result.processed).toBe(1);
    expect(updatedAppointment.reminderSent).toBe(true);
    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: String(doctorUser._id),
        type: "appointment",
        relatedModel: "Appointment",
        relatedId: appointment._id,
        eventKey: `appointment-reminder:${appointment._id}:${appointment.appointmentDate.getTime()}:${doctorUser._id}`,
      })
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: String(receptionist._id),
      })
    );
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("does not send reminders when the clinic has disabled them", async () => {
    await ReminderSettings.create({
      enabled: false,
      minutesBefore: 1,
      lastCheckedAt: null,
    });
    const { appointment } = await createAppointmentFixtures(
      new Date(Date.now() + 90_000)
    );

    const result = await runAppointmentReminders();

    const unchangedAppointment = await Appointment.findById(appointment._id);
    expect(result.enabled).toBe(false);
    expect(unchangedAppointment.reminderSent).toBe(false);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});
