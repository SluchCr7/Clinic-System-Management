const asyncHandler = require("express-async-handler");

const doctorService = require("./doctor.service");
const { AppError } = require("../../middlewares/errorHandler");

const createDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "Doctor created successfully",
    data: doctor,
  });
});

const getDoctors = asyncHandler(async (req, res) => {
  const { data: doctors, pagination } =
    await doctorService.getDoctors(req.validatedQuery);

  res.status(200).json({
    success: true,
    data: doctors,
    pagination,
  });
});

const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getDoctorById(
    req.params.id
  );

  if (!doctor) {
    throw new AppError(
      "Doctor not found",
      404,
      "DOCTOR_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: doctor,
  });
});

const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctor(
    req.params.id,
    req.body,
    req.user
  );

  if (!doctor) {
    throw new AppError(
      "Doctor not found",
      404,
      "DOCTOR_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Doctor updated successfully",
    data: doctor,
  });
});

const deactivateDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctorService.deactivateDoctor(
    req.params.id,
    req.user
  );

  if (!doctor) {
    throw new AppError(
      "Doctor not found",
      404,
      "DOCTOR_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Doctor deactivated successfully",
  });
});

module.exports = {
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  deactivateDoctor,
};