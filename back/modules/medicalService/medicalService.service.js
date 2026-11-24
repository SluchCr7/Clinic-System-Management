const MedicalService = require("./medicalService.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");
const {
  resolveDoctorId,
  getDoctorUserId,
} = require("../../utils/accessControl");

const roundMoney = (val) => {
  if (typeof val !== "number" || isNaN(val)) return val;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

const createMedicalService = async (data, currentUser) => {
  const reqObj = { user: currentUser, body: data, query: {} };
  const doctorId = await resolveDoctorId(reqObj, { required: true });

  const existingService = await MedicalService.findOne({
    doctor: doctorId,
    code: data.code,
  });

  if (existingService) {
    throw new AppError(
      "كود الخدمة مستخدم بالفعل في عيادتك",
      409,
      "SERVICE_CODE_EXISTS"
    );
  }

  const roundedPrice = roundMoney(data.price);

  const medicalService = await MedicalService.create({
    ...data,
    doctor: doctorId,
    price: roundedPrice,
    priceHistory: [
      {
        price: roundedPrice,
        changedAt: new Date(),
        changedBy: currentUser._id,
      },
    ],
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_SERVICE_CREATED",
      resource: "MedicalService",
      resourceId: medicalService._id,
      details: {
        doctor: doctorId,
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

const getMedicalServices = async (query = {}, currentUser) => {
  const filter = {};

  if (currentUser) {
    if (currentUser.role === "doctor") {
      filter.doctor = currentUser._id;
    } else if (currentUser.role === "receptionist") {
      const doctorId = await resolveDoctorId({ user: currentUser });
      filter.doctor = doctorId;
      filter.isActive = true;
    } else if (currentUser.role === "admin") {
      if (query.doctor) {
        const resolvedDoctorId = await getDoctorUserId(query.doctor);
        if (resolvedDoctorId) {
          filter.doctor = resolvedDoctorId;
        } else {
          filter.doctor = query.doctor;
        }
      }
    }
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.isActive !== undefined && currentUser?.role !== "receptionist") {
    filter.isActive =
      query.isActive === true || query.isActive === "true";
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
    ];
  }

  const paginatedResult = await paginateQuery(
    MedicalService.find(filter)
      .populate("doctor", "firstName lastName email")
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
            "isActive",
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

  paginatedResult.pagination.totalPages = paginatedResult.pagination.pages;

  return paginatedResult;
};

const getMedicalServiceById = async (id, currentUser) => {
  const query = { _id: id };

  if (currentUser) {
    if (currentUser.role === "doctor") {
      query.doctor = currentUser._id;
    } else if (currentUser.role === "receptionist") {
      const doctorId = await resolveDoctorId({ user: currentUser });
      query.doctor = doctorId;
      query.isActive = true;
    }
  }

  const medicalService = await MedicalService.findOne(query)
    .populate("doctor", "firstName lastName email")
    .populate("createdBy", "firstName lastName email role")
    .populate("updatedBy", "firstName lastName email role");

  return medicalService;
};

const updateMedicalService = async (id, data, currentUser) => {
  const query = { _id: id };
  if (currentUser && currentUser.role === "doctor") {
    query.doctor = currentUser._id;
  }

  const medicalService = await MedicalService.findOne(query);

  if (!medicalService) {
    return null;
  }

  if (data.code && data.code !== medicalService.code) {
    const existing = await MedicalService.findOne({
      doctor: medicalService.doctor,
      code: data.code,
      _id: { $ne: medicalService._id },
    });

    if (existing) {
      throw new AppError(
        "كود الخدمة مستخدم بالفعل في عيادتك",
        409,
        "SERVICE_CODE_EXISTS"
      );
    }
    medicalService.code = data.code;
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
  if (data.description !== undefined)
    medicalService.description = data.description;
  if (data.category !== undefined) medicalService.category = data.category;
  if (data.notes !== undefined) medicalService.notes = data.notes;

  if (data.price !== undefined) {
    const roundedPrice = roundMoney(data.price);
    if (roundedPrice !== medicalService.price) {
      medicalService.price = roundedPrice;
      medicalService.priceHistory.push({
        price: roundedPrice,
        changedAt: new Date(),
        changedBy: currentUser._id,
      });
    }
  }

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
  const query = { _id: id };
  if (currentUser && currentUser.role === "doctor") {
    query.doctor = currentUser._id;
  }

  const medicalService = await MedicalService.findOne(query);

  if (!medicalService) {
    return null;
  }

  if (!medicalService.isActive) {
    throw new AppError(
      "الخدمة الطبية غير نشطة بالفعل",
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

const activateMedicalService = async (id, currentUser) => {
  const query = { _id: id };
  if (currentUser && currentUser.role === "doctor") {
    query.doctor = currentUser._id;
  }

  const medicalService = await MedicalService.findOne(query);

  if (!medicalService) {
    return null;
  }

  if (medicalService.isActive) {
    throw new AppError(
      "الخدمة الطبية نشطة بالفعل",
      400,
      "SERVICE_ALREADY_ACTIVE"
    );
  }

  const previousIsActive = medicalService.isActive;

  medicalService.isActive = true;
  medicalService.updatedBy = currentUser._id;

  await medicalService.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_SERVICE_ACTIVATED",
      resource: "MedicalService",
      resourceId: medicalService._id,
      details: {
        previousIsActive,
        newIsActive: true,
      },
    });
  }

  return medicalService;
};

const getCategories = async (currentUser, query = {}) => {
  const filter = {};

  if (currentUser) {
    if (currentUser.role === "doctor") {
      filter.doctor = currentUser._id;
    } else if (currentUser.role === "receptionist") {
      const doctorId = await resolveDoctorId({ user: currentUser });
      filter.doctor = doctorId;
      filter.isActive = true;
    } else if (currentUser.role === "admin" && query.doctor) {
      const doctorUserId = await getDoctorUserId(query.doctor);
      if (doctorUserId) filter.doctor = doctorUserId;
    }
  }

  const categories = await MedicalService.distinct("category", filter);
  return categories.filter(Boolean).sort();
};

module.exports = {
  createMedicalService,
  getMedicalServices,
  getMedicalServiceById,
  updateMedicalService,
  deactivateMedicalService,
  activateMedicalService,
  getCategories,
};
