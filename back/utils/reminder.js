const cron = require("node-cron");
const Appointment = require("../modules/Appointment/appointment.model");
const User = require("../modules/User/user.model");
const ReminderSettings = require("../modules/Notification/reminderSettings.model");
const notificationService = require("../modules/Notification/notification.service");
const reminderSettingsService = require("../modules/Notification/reminderSettings.service");
const { formatAppointmentReminder } = require("./appointmentReminder");

const CRON_EXPRESSION = "* * * * *";
const CHECK_INTERVAL_MS = 60 * 1000;
let reminderTask = null;
let runningJob = null;

const runAppointmentReminders = async () => {
  const settings = await reminderSettingsService.getReminderSettings();
  const now = new Date();

  if (!settings.enabled) {
    await ReminderSettings.updateOne(
      { _id: settings._id },
      { $set: { lastCheckedAt: now } }
    );
    return { processed: 0, enabled: false };
  }

  const offsetMs = settings.minutesBefore * 60 * 1000;
  const windowStart = settings.lastCheckedAt
    ? new Date(settings.lastCheckedAt.getTime() + offsetMs)
    : new Date(now.getTime() + offsetMs);
  const windowEnd = settings.lastCheckedAt
    ? new Date(now.getTime() + offsetMs)
    : new Date(windowStart.getTime() + CHECK_INTERVAL_MS);

  const appointments = await Appointment.find({
    appointmentDate: {
      $gt: now,
      $gte: windowStart,
      $lte: windowEnd,
    },
    status: { $in: ["scheduled", "confirmed"] },
    reminderSent: false,
  })
    .populate("patient", "firstName lastName")
    .populate({
      path: "doctor",
      select: "user",
      populate: {
        path: "user",
        select: "firstName lastName",
      },
    })
    .populate("createdBy", "firstName lastName");

  let processed = 0;

  for (const appointment of appointments) {
    if (!appointment.patient || !appointment.doctor) {
      throw new Error(
        `Appointment ${appointment._id} is missing its patient or doctor`
      );
    }
    if (!appointment.doctor.user) {
      throw new Error(
        `Appointment ${appointment._id} has a doctor without an assigned user`
      );
    }

    const message = formatAppointmentReminder({
      patient: appointment.patient,
      doctor: appointment.doctor.user,
      appointmentDate: appointment.appointmentDate,
    });
    const possibleRecipients = [
      appointment.doctor.user?._id,
      appointment.createdBy?._id,
    ]
      .filter(Boolean)
      .map(String)
      .filter((recipient, index, all) => all.indexOf(recipient) === index);
    const activeRecipients = await User.find({
      _id: { $in: possibleRecipients },
      isActive: true,
    }).select("_id");
    const recipients = activeRecipients.map(({ _id }) => String(_id));

    if (recipients.length === 0) {
      throw new Error(
        `Appointment ${appointment._id} has no notification recipients`
      );
    }

    for (const recipient of recipients) {
      await notificationService.createNotification({
        recipient,
        type: "appointment",
        title: "Upcoming appointment reminder",
        message,
        relatedModel: "Appointment",
        relatedId: appointment._id,
        eventKey: `appointment-reminder:${appointment._id}:${appointment.appointmentDate.getTime()}:${recipient}`,
      });
    }

    const result = await Appointment.updateOne(
      {
        _id: appointment._id,
        status: { $in: ["scheduled", "confirmed"] },
        reminderSent: false,
      },
      { $set: { reminderSent: true } }
    );
    if (result.modifiedCount === 1) processed += 1;
  }

  await ReminderSettings.updateOne(
    { _id: settings._id },
    { $set: { lastCheckedAt: now } }
  );

  return { processed, enabled: true };
};

const startReminderJob = () => {
  if (reminderTask) return reminderTask;

  const runAndLogErrors = () => {
    if (!runningJob) {
      runningJob = runAppointmentReminders()
        .catch((error) => {
          console.error("Appointment reminder worker failed:", error);
        })
        .finally(() => {
          runningJob = null;
        });
    }
    return runningJob;
  };

  reminderTask = cron.schedule(
    CRON_EXPRESSION,
    runAndLogErrors,
    { noOverlap: true }
  );

  runAndLogErrors();

  return reminderTask;
};

const stopReminderJob = async () => {
  if (!reminderTask) return;
  reminderTask.stop();
  reminderTask = null;
  if (runningJob) await runningJob;
};

module.exports = {
  runAppointmentReminders,
  startReminderJob,
  stopReminderJob,
};
