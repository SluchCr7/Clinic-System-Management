const asyncHandler = require("express-async-handler");
const medicalServiceService = require("./medicalService.service");
const { AppError } = require("../../middlewares/errorHandler");

const createMedicalService = asyncHandler(async (req, res) => {
  // Strip doctor if not admin
  if (req.user.role !== "admin") {
    delete req.body.doctor;
  }

  const medicalService = await medicalServiceService.createMedicalService(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "تم إنشاء الخدمة الطبية بنجاح",
    data: medicalService,
  });
});

const getMedicalServices = asyncHandler(async (req, res) => {
  const { data: medicalServices, pagination } =
    await medicalServiceService.getMedicalServices(
      req.validatedQuery || req.query,
      req.user
    );

  res.status(200).json({
    success: true,
    data: medicalServices,
    pagination,
  });
});

const getMedicalServiceById = asyncHandler(async (req, res) => {
  const medicalService = await medicalServiceService.getMedicalServiceById(
    req.params.id,
    req.user
  );

  if (!medicalService) {
    throw new AppError(
      "الخدمة الطبية غير موجودة",
      404,
      "MEDICAL_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: medicalService,
  });
});

const updateMedicalService = asyncHandler(async (req, res) => {
  // Strip doctor if not admin
  if (req.user.role !== "admin") {
    delete req.body.doctor;
  }

  const medicalService = await medicalServiceService.updateMedicalService(
    req.params.id,
    req.body,
    req.user
  );

  if (!medicalService) {
    throw new AppError(
      "الخدمة الطبية غير موجودة",
      404,
      "MEDICAL_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "تم تحديث الخدمة الطبية بنجاح",
    data: medicalService,
  });
});

const deactivateMedicalService = asyncHandler(async (req, res) => {
  const medicalService = await medicalServiceService.deactivateMedicalService(
    req.params.id,
    req.user
  );

  if (!medicalService) {
    throw new AppError(
      "الخدمة الطبية غير موجودة",
      404,
      "MEDICAL_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "تم إلغاء تفعيل الخدمة الطبية بنجاح",
    data: medicalService,
  });
});

const activateMedicalService = asyncHandler(async (req, res) => {
  const medicalService = await medicalServiceService.activateMedicalService(
    req.params.id,
    req.user
  );

  if (!medicalService) {
    throw new AppError(
      "الخدمة الطبية غير موجودة",
      404,
      "MEDICAL_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "تم تفعيل الخدمة الطبية بنجاح",
    data: medicalService,
  });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await medicalServiceService.getCategories(
    req.user,
    req.query
  );

  res.status(200).json({
    success: true,
    data: categories,
  });
});

module.exports = {
  createMedicalService,
  getMedicalServices,
  getMedicalServiceById,
  updateMedicalService,
  deactivateMedicalService,
  activateMedicalService,
  getCategories,
};
