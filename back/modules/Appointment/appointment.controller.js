const asyncHandler = require("express-async-handler");

const appointmentService = require("./appointment.service");
const {AppError} = require("../../middlewares/errorHandler");

const createAppointment = asyncHandler(async (req, res) => {
  const appointment =
    await appointmentService.createAppointment(
      req.body,
      req.user
    );

  res.status(201).json({
    success: true,
    message: "Appointment created successfully",
    data: appointment,
  });
});

const getAppointments = asyncHandler(async (req, res) => {
  const { data: appointments, pagination } =
    await appointmentService.getAppointments(
      req.validatedQuery,
      req.user
    );

  res.status(200).json({
    success: true,
    data: appointments,
    pagination,
  });
});

const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment =
    await appointmentService.getAppointmentById(
      req.params.id
    );

  if (!appointment) {
    throw new AppError(
      "Appointment not found",
      404,
      "APPOINTMENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: appointment,
  });
});

const updateAppointment = asyncHandler(async (req, res) => {
  const appointment =
    await appointmentService.updateAppointment(
      req.params.id,
      req.body,
      req.user
    );

  if (!appointment) {
    throw new AppError(
      "Appointment not found",
      404,
      "APPOINTMENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Appointment updated successfully",
    data: appointment,
  });
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body;

  const appointment =
    await appointmentService.cancelAppointment(
      req.params.id,
      cancellationReason,
      req.user
    );

  if (!appointment) {
    throw new AppError(
      "Appointment not found",
      404,
      "APPOINTMENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Appointment cancelled successfully",
    data: appointment,
  });
});

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};