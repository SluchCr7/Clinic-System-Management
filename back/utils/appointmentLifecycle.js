const { AppError } = require("../middlewares/errorHandler");

const NO_SHOW_GRACE_PERIOD_MINUTES = (() => {
  const configuredMinutes = process.env.APPOINTMENT_NO_SHOW_GRACE_PERIOD_MINUTES;
  const minutes =
    configuredMinutes === undefined ? 15 : Number(configuredMinutes);

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw new Error(
      "APPOINTMENT_NO_SHOW_GRACE_PERIOD_MINUTES must be an integer from 0 to 1440"
    );
  }

  return minutes;
})();

const ALLOWED_TRANSITIONS = {
  scheduled: ["confirmed", "checked_in", "cancelled", "no-show"],
  confirmed: ["checked_in", "cancelled", "no-show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  "no-show": [],
};

const ROLE_ALLOWED_TRANSITIONS = {
  receptionist: ["confirmed", "checked_in", "cancelled", "no-show"],
  doctor: ["in_progress", "completed", "cancelled"],
  admin: [],
};

const getNoShowEligibleAt = (appointmentDate) =>
  new Date(
    new Date(appointmentDate).getTime() +
      NO_SHOW_GRACE_PERIOD_MINUTES * 60 * 1000
  );

const assertNoShowEligible = (appointment, now = new Date()) => {
  if (appointment.checkedInAt || appointment.status === "checked_in") {
    throw new AppError(
      "A checked-in patient cannot be marked as a no-show",
      400,
      "NO_SHOW_NOT_ELIGIBLE"
    );
  }

  if (now < getNoShowEligibleAt(appointment.appointmentDate)) {
    throw new AppError(
      `No-show can only be recorded ${NO_SHOW_GRACE_PERIOD_MINUTES} minutes after the appointment time`,
      400,
      "NO_SHOW_TOO_EARLY"
    );
  }
};

const transitionAppointment = (
  appointment,
  nextStatus,
  actor,
  { reason, source = "api", noShowMethod = "manual", changedAt = new Date() } = {}
) => {
  const currentStatus = appointment.status;
  const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!validNextStates.includes(nextStatus)) {
    throw new AppError(
      `Cannot transition appointment from '${currentStatus}' to '${nextStatus}'`,
      400,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const roleAllowed = ROLE_ALLOWED_TRANSITIONS[actor?.role] || [];
  if (!roleAllowed.includes(nextStatus)) {
    throw new AppError(
      `Role '${actor?.role}' is not authorized to transition appointment to '${nextStatus}'`,
      403,
      "FORBIDDEN"
    );
  }

  if (nextStatus === "in_progress" && source !== "visit") {
    throw new AppError(
      "Start an examination through the visit workflow",
      400,
      "VISIT_WORKFLOW_REQUIRED"
    );
  }

  if (nextStatus === "cancelled" && !reason?.trim()) {
    throw new AppError(
      "Cancellation reason is required",
      400,
      "CANCELLATION_REASON_REQUIRED"
    );
  }

  if (nextStatus === "no-show") {
    assertNoShowEligible(appointment, changedAt);
  }

  appointment.status = nextStatus;
  appointment.statusHistory.push({
    from: currentStatus,
    to: nextStatus,
    changedBy: actor?._id,
    changedAt,
    ...(reason ? { reason: reason.trim() } : {}),
  });

  if (nextStatus === "confirmed") {
    appointment.confirmedAt = changedAt;
    appointment.confirmedBy = actor._id;
  } else if (nextStatus === "checked_in") {
    appointment.checkedInAt = changedAt;
    appointment.checkedInBy = actor._id;
  } else if (nextStatus === "in_progress") {
    appointment.startedAt = changedAt;
    appointment.startedBy = actor._id;
  } else if (nextStatus === "completed") {
    appointment.completedAt = changedAt;
    appointment.completedBy = actor._id;
  } else if (nextStatus === "cancelled") {
    appointment.cancelledAt = changedAt;
    appointment.cancelledBy = actor._id;
    appointment.cancellationReason = reason.trim();
  } else if (nextStatus === "no-show") {
    appointment.noShowAt = changedAt;
    appointment.noShowBy = actor._id;
    appointment.noShowMethod = noShowMethod;
  }

  return appointment;
};

const createInitialStatusHistory = (actor, changedAt = new Date()) => [
  {
    from: null,
    to: "scheduled",
    changedBy: actor?._id,
    changedAt,
    reason: "Appointment created",
  },
];

module.exports = {
  NO_SHOW_GRACE_PERIOD_MINUTES,
  ALLOWED_TRANSITIONS,
  ROLE_ALLOWED_TRANSITIONS,
  getNoShowEligibleAt,
  assertNoShowEligible,
  transitionAppointment,
  createInitialStatusHistory,
};
