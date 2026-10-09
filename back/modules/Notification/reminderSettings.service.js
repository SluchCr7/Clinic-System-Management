const ReminderSettings = require("./reminderSettings.model");

const SETTINGS_KEY = "appointment-reminders";

const getReminderSettings = async () =>
  ReminderSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

const updateReminderSettings = async (data, currentUser) =>
  ReminderSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        enabled: data.enabled,
        minutesBefore: data.minutesBefore,
        updatedBy: currentUser._id,
        lastCheckedAt: null,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
    }
  );

module.exports = {
  getReminderSettings,
  updateReminderSettings,
};
