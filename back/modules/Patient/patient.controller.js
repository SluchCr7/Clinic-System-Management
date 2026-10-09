const asyncHandler = require("express-async-handler")
const { AppError } = require("../../middlewares/errorHandler")
const patientService = require("./patient.service")

const createPatient = asyncHandler(async (req, res) => {
    const patient = await patientService.createPatient(
        req.body,
        req.user
    )

    res.status(201).json({
        success: true,
        message: "Patient created successfully",
        data: patient,
    })


})


/**
 * @method GET
 * 
 */

const getPatients = asyncHandler(async (req, res) => {
  const { data: patients, pagination } =
    await patientService.getPatients(
      req.validatedQuery,
      req.user
    );

  res.status(200).json({
    success: true,
    data: patients,
    pagination,
  });
});


/**
 * 
 * 
 */

const getPatientById = asyncHandler(async (req, res) => {
    const patient = await patientService.getPatientById(req.params.id, req.user)

    if (!patient) {
        throw new AppError(
            "Patient not found",
            404,
            "PATIENT_NOT_FOUND"
        );
    }

    res.status(200).json({
        success: true,
        data: patient,
    });
})

// Update Patient
const updatePatient = asyncHandler(async (req, res) => {
  const patient = await patientService.updatePatient(
    req.params.id,
    req.body,
    req.user
  );

  if (!patient) {
    throw new AppError(
      "Patient not found",
      404,
      "PATIENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Patient updated successfully",
    data: patient,
  });
});


// Deactivate Patient
const deletePatient = asyncHandler(async (req, res) => {
  const patient = await patientService.deletePatient(
    req.params.id,
    req.user
  );

  if (!patient) {
    throw new AppError(
      "Patient not found",
      404,
      "PATIENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Patient deactivated successfully",
  });
});


module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};