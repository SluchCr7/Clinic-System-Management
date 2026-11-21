const asyncHandler = require("express-async-handler");
const clinicService = require("./clinic.service");

const getMyClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.getMyClinic(req.user);
  res.status(200).json({
    success: true,
    data: clinic,
  });
});

const updateMyClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.updateMyClinic(req.user, req.body);
  res.status(200).json({
    success: true,
    message: "Clinic updated successfully",
    data: clinic,
  });
});

module.exports = { getMyClinic, updateMyClinic };
