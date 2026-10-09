const MedicalService = require("./medicalService.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");

const createMedicalService = async (data, currentUser) => {
  const existingService = await MedicalService.findOne({
    code: data.code,
  });

  if (existingService) {
    throw new AppError(
      "Medical service code already exists",
      409,
      "SERVICE_CODE_EXISTS"
    );
  }

  const medicalService = await MedicalService.create({
    ...data,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_SERVICE_CREATED",
      resource: "MedicalService",
      resourceId: medicalService._id,
      details: {
        name: medicalService.name,
        code: medicalService.code,
        category: medicalService.category,
        price: medicalService.price,
        duration: medicalService.duration,
        isActive: medicalService.isActive,
      },
    });
  }

  return medicalService;
};

const getMedicalServices = async (query = {}) => {
  const filter = {};

  if (query.category) {
    filter.category = query.category;
  }

  if (query.isActive !== undefined) {
    filter.isActive =
      query.isActive === true || query.isActive === "true";
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
    ];
  }

  return paginateQuery(
    MedicalService.find(filter)
      .populate("createdBy", "firstName lastName email role")
      .populate("updatedBy", "firstName lastName email role")
      .sort(
        getSort(
          query,
          [
            "name",
            "code",
            "category",
            "price",
            "duration",
            "createdAt",
            "updatedAt",
          ],
          "createdAt"
        )
      ),
    MedicalService.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getMedicalServiceById = async (id) => {
  return await MedicalService.findById(id)
    .populate("createdBy", "firstName lastName email role")
    .populate("updatedBy", "firstName lastName email role");
};

const updateMedicalService = async (id, data, currentUser) => {
  const medicalService = await MedicalService.findById(id);

  if (!medicalService) {
    return null;
  }

  const previousValues = {
    name: medicalService.name,
    code: medicalService.code,
    category: medicalService.category,
    price: medicalService.price,
    duration: medicalService.duration,
    isActive: medicalService.isActive,
  };

  if (data.name !== undefined) medicalService.name = data.name;
  if (data.description !== undefined) medicalService.description = data.description;
  if (data.category !== undefined) medicalService.category = data.category;
  if (data.price !== undefined) medicalService.price = data.price;
  if (data.duration !== undefined) medicalService.duration = data.duration;
  if (data.isActive !== undefined) medicalService.isActive = data.isActive;

  medicalService.updatedBy = currentUser._id;
  await medicalService.save();

  const newValues = {
    name: medicalService.name,
    code: medicalService.code,
    category: medicalService.category,
    price: medicalService.price,
    duration: medicalService.duration,
    isActive: medicalService.isActive,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_SERVICE_UPDATED",
      resource: "MedicalService",
      resourceId: medicalService._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return medicalService;
};

const deactivateMedicalService = async (id, currentUser) => {
  const medicalService = await MedicalService.findById(id);

  if (!medicalService) {
    return null;
  }

  if (!medicalService.isActive) {
    throw new AppError(
      "Medical service is already inactive",
      400,
      "SERVICE_ALREADY_INACTIVE"
    );
  }

  const previousIsActive = medicalService.isActive;

  medicalService.isActive = false;
  medicalService.updatedBy = currentUser._id;

  await medicalService.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_SERVICE_DEACTIVATED",
      resource: "MedicalService",
      resourceId: medicalService._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return medicalService;
};

module.exports = {
  createMedicalService,
  getMedicalServices,
  getMedicalServiceById,
  updateMedicalService,
  deactivateMedicalService,
};